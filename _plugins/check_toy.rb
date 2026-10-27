# 301. toy: fail the build on a dangling id in _data/toy.yml, which would
# otherwise blank the side pane with a script error in the browser, or on a
# step's code that has drifted from the listing it is cut from.
Jekyll::Hooks.register :site, :post_read do |site|
  d = site.data["toy"]
  pre = d["prerequisites"].map { |p| p["id"] }
  dup = pre.tally.select { |_, n| n > 1 }.keys
  raise "toy.yml: duplicate prerequisite id #{dup.join(', ')}" unless dup.empty?
  d["prerequisites"].each do |p|
    raise "toy.yml: prerequisite #{p["id"]} is missing its title" if p["title"].nil?
    raise "toy.yml: prerequisite #{p["id"]} has nothing to show" if %w[def body points code].all? { |k| p[k].nil? }
  end
  filed = []
  d["components"].each do |c|
    %w[id n name nav tag pre steps].each do |k|
      raise "toy.yml: component #{c["id"]} is missing #{k}" if c[k].nil?
    end
    bad = (c["pre"] + (c["also"] || [])) - pre
    raise "toy.yml: component #{c["id"]} names unknown prerequisite #{bad.join(', ')}" unless bad.empty?
    filed += c["pre"]
  end
  stray = pre - filed
  raise "toy.yml: prerequisite #{stray.join(', ')} is filed under no component" unless stray.empty?
  twice = filed.tally.select { |_, n| n > 1 }.keys
  raise "toy.yml: prerequisite #{twice.join(', ')} is filed under two components" unless twice.empty?
  # toy.js draws one step a row of its STEPS table
  table = File.read(File.join(site.source, "assets/js/toy.js"))[/^\tconst STEPS = \[\n(.*?)^\t\];/m, 1]
  raise "check_toy.rb: no STEPS table in toy.js" if table.nil?
  drawn = table.lines.size
  raise "toy.yml: toy.js is drawn for #{drawn} steps, the file has #{d["steps"].size}" unless d["steps"].size == drawn
  steps = d["components"].flat_map { |c| c["steps"] }.sort
  raise "toy.yml: the components' steps must cover 0..#{d["steps"].size - 1} once each" unless steps == (0...d["steps"].size).to_a
  d["steps"].each_with_index do |s, i|
    %w[title eq maths uses code notes].each do |k|
      raise "toy.yml: step #{i + 1} is missing #{k}" if s[k].nil?
    end
    bad = s["uses"] - pre
    raise "toy.yml: step #{i + 1} uses unknown prerequisite #{bad.join(', ')}" unless bad.empty?
  end
  # each step's code, its prints aside, is the next run of lines in the loop of the listing (§0.5)
  listing = d["prerequisites"].find { |p| p["id"] == "code" }
  raise "toy.yml: no listing, the prerequisite with id code" if listing.nil?
  bare = ->(line) { line.sub(/\s+#.*$/, "").strip }
  loop_body = listing["code"].split("\nfor t, w in enumerate(ids):\n", 2)[1]
  raise "toy.yml: the listing has no loop over the tokens" if loop_body.nil?
  body = loop_body.lines.map(&bare).reject(&:empty?)
  at = 0
  d["steps"].each_with_index do |s, i|
    lines = s["code"].lines.map(&bare).reject { |l| l.empty? || l.start_with?("print(") }
    raise "toy.yml: step #{i + 1}'s code is not the listing's next lines" unless body[at, lines.size] == lines
    at += lines.size
  end
  raise "toy.yml: the listing has lines no step shows" unless at == body.size
end
