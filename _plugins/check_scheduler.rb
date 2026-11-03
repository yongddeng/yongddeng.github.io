# scheduler.exe: fail the build on a chat in _data/scheduler_chats.yml that
# scheduler.js would misread, which would otherwise show as a garbled answer or
# blank the window with a script error in the browser. How a chat is
# written is the YAML's head; this holds a chat to it, and to what scheduler.js
# can do with it: a lang its LANGS share out, a make its MAKERS have a rule
# for, and sizes ({n}, {a}, …) its rule names; and no "</", which would end
# the page's script early.
Jekyll::Hooks.register :site, :post_read do |site|
  chats = site.data["scheduler_chats"]
  raise "scheduler_chats.yml: no chats" unless chats.is_a?(Array) && !chats.empty?
  # scheduler.js shares the chats out by its LANGS and makes their items by its
  # MAKERS, each rule naming the sizes its vars give, its count {n} if none
  js = File.read(File.join(site.source, "assets/js/scheduler.js"))
  langs = js[/^\tconst LANGS = (.*?\]);$/m, 1]&.scan(/'([a-z]{2})'/)&.flatten
  raise "check_scheduler.rb: no LANGS in scheduler.js" if langs.nil? || langs.empty?
  table = js[/^\tconst MAKERS = \{\n(.*?)^\t\};/m, 1]
  raise "check_scheduler.rb: no MAKERS table in scheduler.js" if table.nil?
  makers = table.split(/^(?=\t\t\w+: \{)/).filter_map do |rule|
    name = rule[/\A\t\t(\w+): \{/, 1]
    vars = rule[/vars: n => \(\{(.*?)\}\)/, 1]
    [name, vars ? vars.scan(/(\w+):/).flatten : ["n"]] if name
  end.to_h
  raise "check_scheduler.rb: no rules in scheduler.js's MAKERS" if makers.empty?
  strings = ->(v) { v.is_a?(String) ? [v] : v.is_a?(Array) ? v.flat_map(&strings) : [] }
  chats.each_with_index do |c, i|
    at = "scheduler_chats.yml: chat #{i + 1} (#{c["ask"].to_s[0, 40]})"
    stray = c.keys - %w[lang ask paste make answer]
    raise "#{at} has #{stray.join(', ')}, which scheduler.js doesn't read" unless stray.empty?
    %w[lang ask answer].each { |k| raise "#{at} is missing #{k}" if c[k].nil? }
    raise "#{at}: lang #{c["lang"]} is not one of scheduler.js's LANGS (#{langs.join(', ')})" unless langs.include?(c["lang"])
    raise "#{at}: make #{c["make"]} has no rule in scheduler.js's MAKERS" if c["make"] && !makers.key?(c["make"])
    raise "#{at}: its answer is not a list of pieces" unless c["answer"].is_a?(Array) && !c["answer"].empty?
    c["answer"].each do |p|
      text = p.is_a?(Array) && p.size == 1 ? p[0] : p
      raise "#{at}: a piece is neither a string nor a list of one: #{p.inspect[0, 60]}" unless text.is_a?(String)
      marks = text.scan(/[⟨⟩]/)
      raise "#{at}: ⟨…⟩ unclosed or nested in #{text[0, 40].inspect}" unless marks.each_slice(2).all? { |a, b| a == "⟨" && b == "⟩" }
      raise "#{at}: {items} is a piece of its own, said whatever the length" if text.include?("{items}") && !(p == "{items}" && c["make"])
    end
    all = strings.(c["answer"]) + [c["ask"], c["paste"]].compact
    raise "#{at}: \"</\" would end the page's script early" if all.any? { |s| s.include?("</") }
    sizes = all.flat_map { |s| s.scan(/\{(\w+)\}/).flatten } - ["items"]
    if c["make"]
      named = makers[c["make"]]
      raise "#{at}: {#{(sizes - named).join('}, {')}} is no size the rule #{c["make"]} names ({#{named.join('}, {')}})" unless (sizes - named).empty?
      raise "#{at}: make with no {items} piece for its items" unless c["answer"].count("{items}") == 1
      raise "#{at}: make but the ask names none of its rule's sizes ({#{named.join('}, {')}})" unless named.any? { |k| c["ask"].include?("{#{k}}") }
    else
      raise "#{at}: a size ({#{sizes.join('}, {')}}) without make" unless sizes.empty?
    end
  end
end
