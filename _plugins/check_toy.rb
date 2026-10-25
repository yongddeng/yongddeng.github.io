# 301. toy: fail the build on a dangling id in _data/toy.yml, which would
# otherwise blank the side pane with a script error in the browser.
Jekyll::Hooks.register :site, :post_read do |site|
  d = site.data["toy"]
  pre = d["prerequisites"].map { |p| p["id"] }
  dup = pre.tally.select { |_, n| n > 1 }.keys
  raise "toy.yml: duplicate prerequisite id #{dup.join(', ')}" unless dup.empty?
  d["prerequisites"].each do |p|
    raise "toy.yml: prerequisite #{p["id"]} is missing its title or body" if p["title"].nil? || p["body"].nil?
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
  raise "toy.yml: toy.js is drawn for 18 steps, the file has #{d["steps"].size}" unless d["steps"].size == 18
  steps = d["components"].flat_map { |c| c["steps"] }.sort
  raise "toy.yml: the components' steps must cover 0..#{d["steps"].size - 1} once each" unless steps == (0...d["steps"].size).to_a
  d["steps"].each_with_index do |s, i|
    %w[title eq uses notes].each do |k|
      raise "toy.yml: step #{i + 1} is missing #{k}" if s[k].nil?
    end
    bad = s["uses"] - pre
    raise "toy.yml: step #{i + 1} uses unknown prerequisite #{bad.join(', ')}" unless bad.empty?
  end
end
