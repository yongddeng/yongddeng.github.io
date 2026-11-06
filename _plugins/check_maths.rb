# 2NN. maths: fail the build on an iframe naming a figure that assets/blog/maths
# doesn't draw, which a reader would get as "no figure …" in the post, or on a
# figure that no post embeds.
Jekyll::Hooks.register :site, :post_read do |site|
  drawn = Dir[File.join(site.source, "assets/blog/maths/2*.js")].flat_map do |f|
    File.read(f).scan(/^FIGS\['([^']+)'\]/).flatten
  end
  embedded = []
  site.posts.docs.each do |p|
    names = p.content.gsub(Explorer::HIDDEN, "").scan(/maths\.html#([^"]+)"/).flatten
    bad = names - drawn
    raise "#{p.relative_path}: no figure #{bad.join(', ')}" unless bad.empty?
    embedded += names
  end
  unused = drawn - embedded
  raise "assets/blog/maths: figure #{unused.join(', ')} is in no post" unless unused.empty?
end
