# What's This? on the maths posts (whatsthis.js): the terms maths200 defines,
# as /assets/terms.json, each with the post that defines it. A term is what a
# definition or a result marks with an empty link, [term](), a block running
# on from its head as statements.js runs it, up to a heading, a proof, a rule
# or a figure. Only names of more than one word, which mean the same wherever
# they are used, and none with TeX in it; the first post to define one has it.
require "json"

module Terms
  HEAD = /\A\*{1,2}(Definition|Theorem|Proposition|Lemma|Corollary|Examples?|Remarks?)\b/
  ENDS = /\A(#|<details|-{3,}|- <div)/
  KEPT = %w[Definition Theorem Proposition Lemma Corollary].freeze

  module_function

  def of(post)
    kind = nil
    # a heading and its rule often sit on the lines just above a statement
    text = post.content.gsub(Explorer::HIDDEN, "").gsub(/^(#.*|-{3,})$/) { "\n#{$1}\n" }
    text.split(/\n\s*\n/).flat_map do |para|
      para = para.lstrip
      kind = para[HEAD, 1] || (para =~ ENDS ? nil : kind)
      next [] unless KEPT.include?(kind)
      para.scan(/\[([^\]]+)\]\(\)/).flatten.select { |t| t =~ /[ '-]/ && !t.include?("$") }
    end
  end
end

class TermsJSON < Jekyll::Generator
  def generate(site)
    homes = {}
    site.posts.docs.select { |p| p.data["tags"].include?("maths200") }.sort_by(&:date).each do |p|
      Terms.of(p).each { |t| homes[t] ||= p.url }
    end
    page = Jekyll::PageWithoutAFile.new(site, site.source, "assets", "terms.json")
    page.content = JSON.generate(homes.to_a)
    site.pages << page
  end
end
