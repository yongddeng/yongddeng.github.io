# §NNN in a post names the post titled "NNN. …" (xref.js): fail the build on
# one that names no post, which a reader would get as plain text.
Jekyll::Hooks.register :site, :post_read do |site|
  posts = site.posts.docs.map { |p| p.data["title"].to_s[/\A\d{3}/] }.compact
  site.posts.docs.each do |p|
    shown = p.content.gsub(Explorer::HIDDEN, "")
    bad = shown.scan(/§(\d{3})/).flatten.uniq - posts
    raise "#{p.relative_path}: §#{bad.join(', §')} names no post" unless bad.empty?
  end
end
