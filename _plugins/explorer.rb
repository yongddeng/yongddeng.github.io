# My Computer's facts about each post (assets/js/explorer.js): the opening
# sentence, parts and sections, figures, formulas, and the date of the last
# commit to touch it. Read from the markdown before anything renders, so
# every page's index carries all of them. And about each program on (D:)
# (_programs): the note it draws for, its script's size, and its date.
require "open3"

module Explorer
  HIDDEN = /\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}|<!--.*?-->/m
  TEX = /(\$\$.+?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/m

  module_function

  # The first paragraph of prose: after the title, past headings, rules and
  # markup, a quote mark dropped
  def opening(text)
    body = text.sub(/\A.*?^# [^\n]*\n/m, "")
    body.split(/\n\s*\n/).each do |para|
      lines = para.lines.map(&:strip).reject { |l| l.empty? || l =~ /\A(#|-{3,}|<|\{%|\|)/ }
      next if lines.empty?
      return sentence(plain(lines.map { |l| l.sub(/\A>\s?/, "") }.join(" ")))
    end
    ""
  end

  # Markdown to text outside the TeX, as kramdown would print it; inside
  # the TeX only kramdown's escapes are undone
  def plain(s)
    s.split(TEX).each_with_index.map do |part, i|
      next part.gsub(/\\([_*|])/, '\1') if i.odd?
      part.gsub(/!?\[([^\]]*)\]\([^)]*\)/, '\1').gsub(/<[^>]+>/, "")
        .gsub(/\*\*(.+?)\*\*|\*(.+?)\*|\b_(.+?)_\b|`(.+?)`/) { $1 || $2 || $3 || $4 }
        .gsub(/\\([\\`*_{}\[\]()#+\-.!|$])/, '\1')
        .gsub(/(\w)'/, "\\1’").gsub(/'(\w)/, "‘\\1").gsub(/"(\S)/, "“\\1").gsub(/(\S)"/, "\\1”")
        .gsub("...", "…").gsub(" -- ", " – ")
    end.join
  end

  # Up to the first full stop outside the TeX that is not an abbreviation's
  def sentence(s)
    s = s.sub(/\Atbd…\s*/, "")
    math = false
    s.each_char.with_index do |c, i|
      math = !math if c == "$" && (i.zero? || s[i - 1] != "\\")
      next if math
      if c == "." && i > 40 && (s[i + 1].nil? || s[i + 1] == " ") && s[[0, i - 6].max...i] !~ /(e\.g|i\.e|i\.i\.d|cf|vs|etc|aka)\z/
        return s[0..i]
      end
      return s[0...i] + "…" if i > 260 && c == " "
    end
    s
  end

  # The last commit to touch the document or any of the other paths given;
  # before the first, the document's own date
  def modified(site, doc, *paths)
    out, = Open3.capture2("git", "-C", site.source, "log", "-1", "--format=%cs", "--", doc.relative_path, *paths)
    out.strip.empty? ? doc.date.strftime("%F") : out.strip
  end

  # The programs open on controls rather than prose, so say what they hold
  def about(site, post)
    case post.data["title"][0, 3]
    when "301"
      toy = site.data["toy"]
      ["#{toy["steps"].size} steps through one decoder layer",
        toy["components"].map { |c| c["name"] }.drop(1).join(" · ")]
    when "302"
      d = site.data["decoder_block"]
      ["#{d["models"].size} decoder models, part by part", "#{d["parts"].size} parts, and a diff between any two"]
    when "303"
      d = site.data["ml_literature"]
      ["#{d["papers"].size} papers on #{d["shelves"].size} shelves", "from #{d["venues"].size} venues, with a timeline of lineage"]
    when "699"
      rows = post.data["rows"]
      ["#{rows.sum { |r| (r["videos"] || []).size }} clips for #{rows.first["n"]} to #{rows.last["n"]}", "one row a topic, in the series’ order"]
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  site.posts.docs.each do |p|
    text = p.content.gsub(Explorer::HIDDEN, "")
    about = Explorer.about(site, p)
    p.data["explorer"] = {
      "lead" => about ? "" : Explorer.opening(text),
      "about" => about,
      "parts" => text.scan(/^## +[IVX]+\s*$/).size,
      "notes" => text.match?(/^## +\*\*\s*$/),
      "sections" => text.scan(/^### +\*\*\d+(?:\.\d+)+\.\s*.+?\*\*\s*$/).size,
      "figures" => text.scan(/<img\b|!\[/).size,
      "formulas" => text.scan(Explorer::TEX).size,
      "modified" => Explorer.modified(site, p),
    }
  end

  # A program is its page and its script, assets/js/<name>.js, so the script
  # is its Size; a note number that names no post fails the build
  site.collections["programs"].docs.each do |x|
    note = site.posts.docs.find { |p| p.data["title"].start_with?("#{x.data["note"]}.") }
    raise "#{x.relative_path}: note #{x.data["note"]} names no post" unless note
    script = "assets/js/#{x.basename_without_ext}.js"
    x.data["explorer"] = {
      "note" => { "title" => note.data["title"], "url" => note.url },
      "size" => "#{(File.size(File.join(site.source, script)) / 1024.0).ceil}KB",
      "modified" => Explorer.modified(site, x, script),
    }
  end
end
