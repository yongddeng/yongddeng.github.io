# 303. blocks: fail the build on a dangling id in _data/decoder_block.yml,
# which would otherwise blank the workbench with a script error in the browser.
Jekyll::Hooks.register :site, :post_read do |site|
  d = site.data["decoder_block"]
  ids = d["models"].map { |m| m["id"] }
  dup = ids.tally.select { |_, n| n > 1 }.keys
  raise "decoder_block.yml: duplicate model id #{dup.join(', ')}" unless dup.empty?
  d["models"].each do |m|
    raise "decoder_block.yml: model #{m["id"]} has unknown parent #{m["parent"]}" if m["parent"] && !ids.include?(m["parent"])
    %w[name date org paper layers width heads kv_heads head_dim attn pos norm ffn vocab ctx params why].each do |k|
      raise "decoder_block.yml: model #{m["id"]} is missing #{k}" if m[k].nil?
    end
  end
  d["parts"].each do |p|
    p["techniques"].each do |t|
      bad = t["models"] - ids
      raise "decoder_block.yml: #{p["id"]}/#{t["id"]} names unknown model #{bad.join(', ')}" unless bad.empty?
    end
    none = ids.reject { |i| p["techniques"].any? { |t| t["models"].include?(i) } }
    raise "decoder_block.yml: no #{p["id"]} technique for #{none.join(', ')}" unless none.empty?
  end
end
