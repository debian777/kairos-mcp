# Writing Style and Language

> "Vigorous writing is concise. A sentence should contain no unnecessary words, a paragraph no unnecessary sentences, for the same reason that a drawing should have no unnecessary lines and a machine no unnecessary parts."
> — Strunk and White, The Elements of Style

## The Problem

Clear thinking produces clear writing. Unclear writing reveals unclear thinking. Most documentation is hard to read not because the topic is complex, but because the author didn't do the work of making it simple.

---

## The Core Rules

### Rule 1: Use Active Voice

Active voice names the actor. Passive voice hides the actor. Active voice is direct, clear, and shorter.

| Passive (Bad) | Active (Good) |
|---|---|
| The database is queried by the API | The API queries the database |
| The file should be deleted | Delete the file |
| An error will be thrown if... | The system throws an error if... |
| The config can be modified | You can modify the config |
| It is recommended that... | We recommend... |

**Why passive voice fails in documentation:**
- Hides who does what
- Adds unnecessary words
- Weakens the message
- Makes instructions ambiguous

**Test:** If you can append "by zombies" and it still makes sense, it's passive voice. "The file was deleted (by zombies)" = passive. "Delete the file (by zombies)" = nonsense = active.

*Source: Strunk and White's "The Elements of Style" (1959). George Orwell's "Politics and the English Language" (1946).*

---

### Rule 2: Front-Load Important Words

Put the most important information at the start of sentences and paragraphs. Readers scan the beginning of each line. Bury the key information halfway through, and they'll miss it.

**Bad:**
```
If you need to deploy quickly without running tests, which is not recommended 
for production but sometimes necessary in emergencies, use the --skip-tests flag.
```

**Good:**
```
Use the --skip-tests flag to deploy without running tests. 
Warning: Not recommended for production.
```

**Apply to:**
- Sentences: Lead with the action or key fact
- Paragraphs: Lead with the main point
- Bullet points: Lead with the important word

*Source: Jakob Nielsen on F-pattern scanning. Ginny Redish's "Letting Go of the Words" (2012).*

---

### Rule 3: Keep Sentences Short

Long sentences increase cognitive load. One idea per sentence. Two ideas per sentence if they're closely related. Three ideas per sentence is almost always too many.

**Target: Maximum 25 words per sentence.**

Not a hard rule — occasionally you'll need longer. But if most sentences exceed 25 words, you're making the reader work too hard.

**Long sentence (38 words):**
```
When deploying to production, you need to make sure that you've run all tests, 
that the staging environment has been verified, and that you've gotten approval 
from at least two team members before proceeding with the deployment.
```

**Broken into short sentences (13, 11, 11 words):**
```
Before deploying to production, complete these steps:
1. Run all tests
2. Verify staging environment
3. Get approval from two team members
```

*Source: Roy Peter Clark's "Writing Tools" (2006). Plain language guidelines (US, UK, EU government standards).*

---

### Rule 4: Keep Paragraphs Short

Long paragraphs trigger skipping. Short paragraphs invite reading.

**Target: Maximum 3-5 sentences per paragraph.**

One-sentence paragraphs are fine. Two-sentence paragraphs are good. Seven-sentence paragraphs are walls of text.

**Why short paragraphs work:**
- Visual whitespace signals "this is manageable"
- Each paragraph becomes a scannable unit
- Easier to find information when scanning
- Mobile-friendly (long paragraphs are worse on small screens)

*Source: "Letting Go of the Words" by Ginny Redish (2012). William Zinsser's "On Writing Well" (1976).*

---

### Rule 5: Use Simple Words

| Instead of | Use |
|---|---|
| Utilize | Use |
| Commence | Start |
| Terminate | End / Stop |
| Subsequently | Then / Later |
| Facilitate | Help |
| Implement | Do / Build |
| Prior to | Before |
| In order to | To |
| At this point in time | Now |
| Due to the fact that | Because |
| In the event that | If |
| With the exception of | Except |
| A majority of | Most |

**Why simple words win:**
- Faster to read
- Easier to understand
- Easier to translate (for non-native speakers)
- Harder to misinterpret

**The test:** Would you say it this way in conversation? If not, simplify.

*Source: George Orwell's "Politics and the English Language" (1946). Plain English guidelines.*

---

## The Ban List

Delete these phrases entirely:

| Phrase | Why It's Bad | Fix |
|---|---|---|
| "It is important to note that" | Filler | Delete, or use "Note:" |
| "Please be advised that" | Bureaucratic | Delete |
| "At this time" | Redundant | "Now" or delete |
| "In order to" | Redundant | "To" |
| "For all intents and purposes" | Pompous | Delete |
| "As a matter of fact" | Filler | Delete |
| "It should be noted that" | Passive | Delete or rewrite actively |
| "Needless to say" | Then don't say it | Delete |
| "Obviously", "Clearly", "Simply" | Condescending | Delete |
| "Just" (as minimizer) | Weakens | Delete |

**If a sentence works without the phrase, delete the phrase.**

*Source: William Zinsser's "On Writing Well" (1976). Strunk and White's "Omit needless words."*

---

## Jargon and Technical Terms

### When to Define Terms

**Always define:**
- Domain-specific jargon (even if obvious to experts)
- Acronyms on first use
- Company/project-specific terms
- Concepts that have multiple meanings

**Format:**
```markdown
The system uses **idempotent** operations (operations that produce the same 
result no matter how many times they're executed).
```

### When to Skip Definitions

If your audience is clearly expert-level and the term is universal in the field, you can skip defining it. But state your assumptions at the top:

```markdown
**Prerequisites:** This guide assumes you understand Kubernetes pods, 
deployments, and services.
```

### Acronyms

**First use:**
```markdown
The Platform Engineering (PE) team maintains...
```

**Subsequent uses:**
```markdown
The PE team...
```

**Exception:** If the acronym is more common than the full term (API, HTTP, DNS), use the acronym throughout. Don't write "Application Programming Interface (API)" unless your audience truly doesn't know what API means.

---

## Tone and Voice

### Be Direct

Write like you're explaining to a colleague, not like you're writing a legal document or academic paper.

**Indirect:**
```
It has been determined that the optimal approach for configuration management 
would involve the utilization of environment variables.
```

**Direct:**
```
Use environment variables for configuration.
```

### Be Confident

**Weak:**
```
You might want to consider trying the --verbose flag, which could possibly 
help with debugging.
```

**Strong:**
```
Use the --verbose flag to see detailed debugging output.
```

Avoid: "might", "may", "could", "possibly", "consider", "try to"

Use: "will", "does", "use", "run"

**Exception:** Use hedging when genuinely uncertain ("This may indicate a network issue").

### Be Helpful, Not Condescending

**Condescending:**
```
Obviously, you'll need to install Node.js first. This is a simple step that 
anyone should be able to complete.
```

**Helpful:**
```
Install Node.js first. If you haven't installed it yet, see the 
[Node.js installation guide](https://nodejs.org).
```

Never use: "Obviously", "Clearly", "Simply", "Just", "Easy", "Trivial"

What's obvious to you isn't obvious to the reader. If it were, they wouldn't be reading the documentation.

---

## Lists and Bullets

### When to Use Lists

Use lists when you have:
- Multiple related items
- Steps in a sequence
- Options or alternatives
- Requirements or prerequisites

**Paragraph form (hard to scan):**
```
To deploy, you need to build the Docker image, push it to the registry, 
update the Kubernetes manifests, and apply them to the cluster.
```

**List form (scannable):**
```
To deploy:
1. Build the Docker image
2. Push to the registry
3. Update Kubernetes manifests
4. Apply to the cluster
```

### Numbered vs. Bulleted

**Use numbered lists for:**
- Sequential steps (order matters)
- Ranked items (priority matters)
- References ("See step 3")

**Use bulleted lists for:**
- Unordered items
- Features or characteristics
- Options (no priority implied)

### List Formatting Rules

**Parallel structure:**
All items should have the same grammatical form.

**Bad (mixed structure):**
- Build the Docker image
- Pushing to registry
- The manifests should be updated
- Apply

**Good (parallel):**
- Build the Docker image
- Push to registry
- Update manifests
- Apply to cluster

**Front-load key words:**

**Bad:**
- The Docker image needs to be built first
- After that, push to the registry
- Then you should update the manifests

**Good:**
- Build the Docker image
- Push to registry
- Update manifests

---

## Code and Commands

### Inline Code

Use backticks for:
- Commands: `npm install`
- File paths: `/etc/config/app.yaml`
- Variable names: `MAX_RETRIES`
- API endpoints: `/api/v1/users`
- Code elements: `getUserById()`

### Code Blocks

Use fenced code blocks with language tags:

````markdown
```bash
npm install
npm start
```
````

**Always include:**
- Language tag (enables syntax highlighting)
- Expected output if it's not obvious
- Context (when/why you'd run this)

**Example:**

````markdown
Check the service status:

```bash
systemctl status myapp
```

Expected output:
```
● myapp.service - My Application
   Loaded: loaded (/etc/systemd/system/myapp.service; enabled)
   Active: active (running) since ...
```
````

### Command Placeholders

Use angle brackets or CAPS for placeholders:

```bash
docker build -t <image-name>:<tag> .
# or
docker build -t IMAGE_NAME:TAG .
```

Explain placeholders before or after:
```markdown
Replace `<image-name>` with your application name and `<tag>` with the version.
```

---

## The Three-Pass Edit

### Pass 1: Structural Edit

- Does each paragraph have one main idea?
- Are paragraphs in the right order?
- Are sections in the right order?
- Is the inverted pyramid structure clear?
- Do headers work as a standalone outline?

### Pass 2: Sentence Edit

- Can I delete entire sentences without losing meaning?
- Are sentences under 25 words?
- Is important information front-loaded?
- Is the voice active?
- Are there simpler words?

### Pass 3: Word Edit

- Can I delete words without losing meaning?
- Are there phrases from the ban list?
- Are there redundant adjectives ("very unique", "completely finished")?
- Are there filler words ("actually", "basically", "essentially")?
- Can I replace phrases with single words?

**Goal: Delete 30-50% of the original draft.**

*Source: Stephen King's "On Writing" (2000). William Zinsser's "On Writing Well" (1976).*

---

## Checklist

Before publishing:
- [ ] Active voice (not passive)
- [ ] Important information front-loaded
- [ ] Sentences under 25 words (most)
- [ ] Paragraphs under 5 sentences
- [ ] Simple words (not "utilize", "facilitate", etc.)
- [ ] Ban list phrases removed
- [ ] Jargon defined on first use
- [ ] Lists for multiple items (not buried in paragraphs)
- [ ] Parallel structure in lists
- [ ] Code formatted with backticks or code blocks
- [ ] Tone is direct and confident
- [ ] No condescending language ("obviously", "simply")
- [ ] Three-pass edit complete

---

**Next**: [Visual Design →](04-visual-design.md)
