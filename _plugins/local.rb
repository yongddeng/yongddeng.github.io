# A program marked `local: true` in its front matter is kept off the site:
# the production build (JEKYLL_ENV=production, as the Pages workflow sets
# it) drops its page from (D:) and its script, assets/js/<name>.js, from the
# output. A local serve builds in development and keeps both.
Jekyll::Hooks.register :site, :post_read, priority: :high do |site|
  next unless Jekyll.env == "production"
  programs = site.collections["programs"].docs
  local = programs.select { |x| x.data["local"] }
  scripts = local.map { |x| site.in_source_dir("assets", "js", "#{x.basename_without_ext}.js") }
  programs.reject! { |x| local.include?(x) }
  site.static_files.reject! { |f| scripts.include?(f.path) }
end
