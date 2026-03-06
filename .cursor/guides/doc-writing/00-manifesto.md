# The Documentation Manifesto

> "The single biggest problem in communication is the illusion that it has taken place."
> — George Bernard Shaw

## The Problem

Documentation fails not because authors don't write enough, but because they write for the wrong goal. They write to **prove they documented**, not to **transfer knowledge**. The result: pages that exist but don't work, information that was recorded but never received.

The reader's brain is not a hard drive. It is a severely bandwidth-limited, interrupt-driven, emotionally gated processor running 47 threads simultaneously. Every unnecessary sentence costs cognitive energy. Every wall of text triggers avoidance: *skip, skim, close tab*. The documentation was written but the knowledge was never transferred. The effort was wasted.

## The Core Belief

Documentation exists to change the reader's brain state. If the reader leaves without understanding, deciding, or acting — the documentation failed. Word count is not a measure of value. Clarity is.

---

## The Commandments

### I. Respect the Reader's Time Above All Else

Your reader is context-switching from Slack, a meeting, and three browser tabs. You have **5 seconds** to prove your documentation is worth reading. If your opening doesn't answer "What is this and why should I care?" — you've already lost them.

**Every reader asks three questions immediately:**
1. What is this?
2. Is this for me?
3. Is this worth my time?

If your first paragraph doesn't answer all three, the reader leaves.

*Source: Jakob Nielsen's F-pattern research (2006, 2020) showed users read only 20-28% of words on a page. Steve Krug's "Don't Make Me Think" (2000) established that content must justify its existence in seconds. Susan Weinschenk's "100 Things Every Designer Needs to Know About People" (2011) on cognitive load and attention.*

### II. Know Your Audience or Fail

The single biggest mistake in documentation: writing for the wrong audience. A system architect and a new hire need fundamentally different information. One document cannot serve both without failing both.

**Before you write a single word, answer:**
- Who will read this?
- What do they already know?
- What are they trying to accomplish?
- What is their cognitive state (calm research vs. production incident)?

If you can't answer these, don't write yet.

*Source: "Living Documentation" by Cyrille Martraire (2019). "Docs Like Code" by Anne Gentle (2017). "The Art of Explanation" by Lee LeFever (2012). Technical writing best practices from Google, Microsoft, and Stripe developer documentation standards.*

### III. Lead with the Answer, Not the Journey

State the conclusion first. Then provide supporting detail for those who need it. This is the **inverted pyramid** — the most important information comes first, detail flows downward. No reader should have to scroll to find out what the documentation is actually about.

**Your reader doesn't care about your discovery process.** They don't need to know what you tried first, what failed, or how you arrived at the answer. They need the answer. If they want the reasoning, they'll keep reading.

*Source: Journalism's inverted pyramid, refined by the Associated Press since the 1860s. Roy Peter Clark's "Writing Tools" (2006). Barbara Minto's "Pyramid Principle" (1987) from McKinsey — lead with the synthesis, support with evidence.*

### IV. One Document, One Purpose

Every document answers exactly one question or serves exactly one function. If you're covering two topics, you need two documents. A document that tries to be a tutorial AND a reference AND a troubleshooting guide is three documents pretending to be one — and failing at all three.

**Test:** Can you state the document's purpose in one sentence? If not, split it.

*Source: Edward Tufte's "data-ink ratio" concept from "The Visual Display of Quantitative Information" (1983) — every element must serve the purpose. "Don't Make Me Think" (Krug, 2000) on single-purpose design. Unix philosophy: "Do one thing well."*

### V. Write for Scanners, Not Readers

Nobody reads documentation word-by-word. They scan. Design for scanning:
- **Bold the key phrases** in each paragraph
- Use headers as a standalone summary
- Front-load important words in sentences and bullets
- Use tables instead of paragraphs for structured data
- Use diagrams for relationships and flows

If someone reads only your headers and bold text, they should get 80% of the message.

*Source: Nielsen Norman Group eye-tracking studies (2006, 2020). "Made to Stick" by Chip and Dan Heath (2007) on concreteness. Ginny Redish's "Letting Go of the Words" (2012) on writing for web readers.*

### VI. Omit Needless Words

"Vigorous writing is concise." Strip every sentence to its cleanest form. Replace phrases with words. Remove qualifiers that add nothing. Delete sentences that restate what the header already says.

| Instead of | Write |
|---|---|
| "In order to" | "To" |
| "At this point in time" | "Now" |
| "Due to the fact that" | "Because" |
| "It is important to note that" | *(delete entirely)* |
| "Please be advised that" | *(delete entirely)* |
| "For all intents and purposes" | *(delete entirely)* |

**Every word must earn its space.**

*Source: Strunk and White's "The Elements of Style" (1959), Rule 17. William Zinsser's "On Writing Well" (1976). George Orwell's "Politics and the English Language" (1946).*

### VII. Structure is Content

A well-structured document with mediocre writing beats a beautifully written wall of text. Structure creates meaning:
- **Headers** = the argument skeleton
- **Bullets** = discrete facts
- **Tables** = comparisons and structured data
- **Callout boxes** = critical warnings or key takeaways
- **Diagrams** = relationships and flows
- **Paragraphs** = explanations and context (use sparingly)

If you can say it in a table, don't say it in a paragraph.

*Source: Richard Saul Wurman's "Information Anxiety" (1989). Tufte's layering principle. "Universal Principles of Design" by Lidwell, Holden, Butler (2003). "Information Architecture" by Rosenfeld, Morville, Arango (2015).*

### VIII. Use Progressive Disclosure

Don't dump everything on the reader at once. Layer information:
1. **Layer 0 — Title**: What is this? (5-10 words)
2. **Layer 1 — Summary**: What do I need to know? (2-5 sentences)
3. **Layer 2 — Key details**: Headers + bullets for the specifics
4. **Layer 3 — Deep dive**: Linked sub-documents, appendices, references

Most readers need Layer 0-1. Some need Layer 2. Almost nobody needs Layer 3 immediately.

*Source: Progressive disclosure in UI design (IBM, 1980s). "Designing Web Usability" by Jakob Nielsen (2000). Alan Cooper's "About Face" (2014). John Carroll's "Minimalist Instruction" research (1990).*

### IX. Make the Next Action Obvious

Every document should answer: "Now what?" If the reader needs to do something — make it unmissable. If the document is informational — tell them where to go next or what related topics exist. Dead-end documents waste the reader's momentum.

*Source: "Don't Make Me Think" (Krug). "Nudge" by Thaler and Sunstein (2008). UX call-to-action principles. "The Design of Everyday Things" by Don Norman (1988) on affordances.*

### X. Date Everything, Own Everything

Every document needs: who wrote it, when, and when it was last verified. Undated documents are untrusted documents. Unowned documents are orphaned documents. Put the date and owner at the top — not buried in metadata nobody checks.

**Readers must be able to answer:** Is this still accurate? Who do I ask if it's not?

*Source: Technical writing standards (IEEE, ISO). "Docs Like Code" by Anne Gentle (2017). "Managing Content as Code" documentation engineering patterns.*

### XI. Kill Your Darlings — Edit Ruthlessly

First drafts are for the author. Final drafts are for the reader. After writing, delete 30-50% of the content. If a section doesn't directly serve the document's single purpose — remove it. If a sentence doesn't earn its space — remove it. If a word doesn't change the meaning — remove it.

**The hardest part of writing is deleting.**

*Source: Arthur Quiller-Couch's 1914 Cambridge lecture "On the Art of Writing." Stephen King's "On Writing" (2000). William Zinsser's "On Writing Well" (1976).*

### XII. White Space is Not Wasted Space

Dense text triggers avoidance. Generous spacing invites reading. Use whitespace to:
- Separate distinct ideas
- Give the eye rest points
- Create visual hierarchy
- Signal "this is manageable"

A document that *looks* easy to read *will be* read.

*Source: Garr Reynolds' "Presentation Zen" (2008). Jan Tschichold's typographic principles. "The Non-Designer's Design Book" by Robin Williams (2004). Josef Müller-Brockmann's grid systems.*

### XIII. Prefer Visuals for Complex Relationships

Diagrams beat paragraphs for: workflows, architectures, hierarchies, timelines, and comparisons. A 10-sentence explanation of a deployment pipeline is inferior to a 5-box flowchart. But: only use visuals that clarify. Decorative images are noise.

**Good visuals reduce cognitive load. Bad visuals increase it.**

*Source: Allan Paivio's "Dual Coding Theory" (1971, 1986) — humans process visuals and text in parallel. Tufte on data visualization. Richard Mayer's "Multimedia Learning" (2001) — the multimedia principle.*

### XIV. Maintain or Archive — Never Abandon

Documentation has a lifecycle: creation, maintenance, archival. The worst state is "abandoned but still discoverable" — outdated information that misleads readers. Either commit to keeping it current, or clearly mark it as archived/deprecated.

**A small set of maintained documents beats a large set of abandoned ones.**

*Source: "Living Documentation" by Cyrille Martraire (2019). "Docs Like Code" by Anne Gentle (2017). Technical debt research by Ward Cunningham. Information lifecycle management principles.*

### XV. Review as Your Reader, Not as the Author

Before publishing, open the document in a new tab. Pretend you know nothing about the topic. Ask:
- Can I tell what this is about in 5 seconds?
- Can I find the key information by scanning?
- Do I know what to do next?
- Is there anything here I'd skip?

If you'd skip it — delete it.

*Source: "Rocket Surgery Made Easy" by Steve Krug (2010). Usability testing principles applied to documentation. "The Sense of Style" by Steven Pinker (2014) on the curse of knowledge.*

---

## The Single Test

> If a reader can act on your documentation after a 30-second scan — the documentation works.

If they can't, no amount of additional content will fix it. The problem is never "not enough information." The problem is always too much of the wrong information, or the right information buried under noise.

---

**Next**: [Audience Analysis →](01-audience.md)
