# A note's pictures load as they scroll into view, so opening a window costs
# only what is on screen; the notes themselves say nothing about loading.
Jekyll::Hooks.register :posts, :post_convert do |post|
  post.content = post.content.gsub(/<img (?![^>]*\bloading=)/, '<img loading="lazy" ')
end
