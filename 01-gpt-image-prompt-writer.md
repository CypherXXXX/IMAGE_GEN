---
name: gpt-image-prompt-writer
description: Writes, upgrades and debugs prompts for GPT Image models (ChatGPT Images, gpt-image-2 / 2.5). Use when the user wants an image prompt written or improved, a matched set or series of prompts, or an explanation of why an image came out generic or wrong.
---

# GPT Image Prompt Writer

Built September 2026 from OpenAI's GPT Image 2.5 prompting guide and cookbook, OpenAI's own Codex `imagegen` skill, and third-party and community testing.

Evidence tags used below:
- **[O]** stated in OpenAI documentation
- **[C]** community or third-party report: a strong hint, not a law
- **[H]** working hypothesis, no proof

Model behaviour changes. If a [C] or [H] rule fails on the user's own results, drop it and say so.

**How to read this file.** Sections 0-2 are the core: apply them to every prompt. Sections 3-4 are the anti-slop system (colour cast, generic typography, sameness). Sections 5-9 are reference: open the module you need, do not recite them. If the user complains about a result, go straight to Section 7.

Contents: 0 Role and output contract · 1 Core rules · 2 Prompt blueprint and length · 3 Anti-slop system · 4 Typography · 5 Modules by image type · 6 Edits, references, series, transparency · 7 Debug table · 8 Templates and worked examples · 9 Lexicon bank · 10 Pre-flight and self-review · 11 Boundaries · Sources

---

## 0. Role and output contract

You turn an image idea into a prompt that a GPT Image model can execute correctly on the first try and that does not look like generic AI output.

**Prompt mode (default):**
- Return the final prompt in ONE code block.
- Then at most three lines: what you assumed, one variation worth trying, and (only if real) one warning.
- No lecture, no rubric scores, no list of the rules you applied.

**Decide, don't interrogate.** Fill gaps the way a strong art director would. Ask at most ONE question, and only when a wrong guess would ruin the image and cannot be inferred: text that must appear verbatim, whose likeness a reference photo shows, or the intended output format.

**Detailed input from the user:** preserve every requirement. Restructure, sharpen, resolve contradictions. Do not add characters, objects, brands, slogans, palettes or story beats the user did not imply. Add detail only where it materially improves the result.

**Vague input:** add tasteful, concrete specifics (light, framing, materials, wear, type direction) that support what was asked, and list the assumptions in one line.

**Several prompts requested:** make them genuinely different (different light, composition, palette, type direction), not paraphrases of one idea.

**Language:** reply in the user's language. Write the image prompt in English. Quote any in-image text exactly, in whatever language it must appear.

---

## 1. Core rules (apply to every prompt)

1. **Unspecified means default.** The image model renders what you specify and fills the rest with safe defaults: polished, warm, centred, evenly sharp, generic sans-serif type. Every visual decision that matters must be written down. [O][C]
2. **Visual facts, not praise.** "Overcast daylight, chipped enamel, 50mm feel" can be drawn. "Stunning, epic, masterpiece, 8K" cannot. [O][C]
3. **Order:** what the artifact is, the medium, the subject and action, setting, composition and camera, light, materials and wear, palette and colour balance, text and type direction, constraints. Name the medium once.
4. **Light is a named source** with direction, quality and colour. Colour balance is stated as neutral unless a cast is wanted.
5. **Typography is a design decision, never a default.** Derive it from the subject's world and describe it in typographic terms (Section 4).
6. **Add believable imperfection:** wear, asymmetry, ordinary clutter, off-centre framing, one sharp focal area with soft falloff elsewhere.
7. **Quote exact text.** Keep it short, say where it goes and what the lettering looks like, and ask for no extra text. [O]
8. **Edits separate CHANGE from PRESERVE.** One change per turn. [O]
9. **Series:** paste the same style block and character specs verbatim; anchor every frame to one hero reference. [O][C]
10. **Exclusions are short and targeted** (3-8 items) and match the failure you expect. A wall of negatives plants the very things you are trying to avoid. [C]
11. **The chat model may rewrite the prompt before the image model sees it.** OpenAI documents this for the image tool in its Responses API [O]; ChatGPT probably works the same way [H]. Write complete, concrete prompts that leave no room for stock embellishment ("warm cinematic lighting", "clean modern typography").
12. **Vary between unrelated images.** Same light, same palette, same type every time is the slop. See Section 3.4.
13. **Match length to the number of must-haves,** not to a word target: about 70-140 words for a standard controlled image, 120-250 for complex artifacts, and split anything past about 350 words. Contradictions hurt more than length. See Section 2.4.

---

## 2. Prompt blueprint

Use only the layers that apply. Length follows the number of things that must be right (Section 2.4: about 70-140 words for a standard controlled image). Every sentence must change the image: if deleting it changes nothing, delete it. [O]

**Format.** OpenAI says short prompts, paragraphs, labelled sections, JSON-like structures and tags can all work: pick whatever makes the requirements easiest to read and update. [O] Practical split: labelled blocks for complex or many-constraint images (posters, UI, infographics, series frames), flowing sentences for a single photographic or painterly scene.

**Front-load must-haves** (medium and subject first, critical constraints early). Some testers report earlier words carry more weight. [H] It costs nothing.

### 2.1 The layers

| # | Layer | What to write |
|---|---|---|
| 1 | Artifact and use | What it is: "documentary photograph", "flat vector logo", "mobile app screen mockup", "printed concert poster", "children's picture-book spread". Sets polish level and layout mode. [O] |
| 2 | Medium and style | The medium once, with its physical traits (line quality, fill, surface grain). For hybrids, state each layer and the rule joining them (Section 5.9). |
| 3 | Subject and action | Who or what; age and build in plain terms; clothing and how it is worn; posture, gaze, what the hands are doing; body framing ("full body, feet visible"); relative scale. [O] |
| 4 | Setting | Place, time, weather, and the ordinary background details a real place has. |
| 5 | Composition and camera | Distance, height, angle, where the subject sits (thirds, bottom-left), what the edges crop, foreground / midground / background layers, depth-of-field behaviour, aspect ratio in words ("wide 16:9 landscape"). Camera specs are appearance cues, not exact physics. [O] |
| 6 | Light | Source, direction, quality, time of day, colour. See 3.2 for colour balance. |
| 7 | Materials and wear | What surfaces are made of and how they are worn, repaired, stained or damp. |
| 8 | Palette and colour balance | 3-5 named colours, an accent limit ("one muted red at most"), "neutral white balance, true whites" unless a cast is wanted. |
| 9 | Text and type | Verbatim text in quotes plus a Type Spec Block (Section 4.3). |
| 10 | Keep / avoid | Invariants that must stay identical (series, edits) and a short exclusion list. Prefer positive phrasing when it is equally clear. |

### 2.2 Compact labelled blueprint

```
USE CASE:
MEDIUM:
SUBJECT & ACTION:
SETTING:
COMPOSITION & CAMERA:
LIGHT:
MATERIALS & WEAR:
PALETTE & COLOUR BALANCE:
TEXT (verbatim) + TYPE DIRECTION:
KEEP / AVOID:
```

### 2.3 Specificity policy (from OpenAI's own imagegen skill) [O]

- User prompt already specific: keep its specificity, only structure it.
- User prompt generic: add concreteness only where it materially improves the result.
- Allowed additions: framing hints, polish level, practical layout, concrete scene detail that supports the request.
- Not allowed: extra characters or objects, brand names, slogans, palettes or narrative beats the request did not imply.

### 2.4 How long should a prompt be?

**Short answer:** there is no single optimal length, and OpenAI publishes none. Length should track the number of independent things that must be right. The ranges below are my synthesis of the evidence that follows; treat them as starting points **[H]**, then test them (see the last rule below).

| Image type | Target length | Approx. characters |
|---|---|---|
| Simple scene with a well-known subject, where you are happy for the model's taste to fill the gaps ("realistic crowd scene, Bethel NY, 16 Aug 1969") | 15-50 words | 100-350 |
| Standard controlled image: photo, illustration, product shot, logo, single-screen mockup | **70-140 words** (the sweet spot) | 450-950 |
| Complex artifact: poster with exact copy, infographic or slide with data, UI with real strings, multi-panel comic | 120-250 words in labelled sections | 800-1,700 |
| Series frame built from reusable blocks (style block 60-150 words, each character spec 40-80, scene 40-100) | 200-400 words total; the blocks are pasted verbatim, so the new thinking per frame stays short | 1,300-2,700 |
| Anything past about 350-400 words | Split it: separate images or panels, move detail into a reference image or character sheet, or cut low-priority detail | above ~2,500 |

Rough conversion: one English word is about 6-7 characters including the space, and about 1.3 tokens.

**Evidence**

1. **Hard limit.** The API accepts up to 32,000 characters per prompt for the GPT image models (counted in characters, not tokens). [O][C] That is a ceiling, not a target.
2. **OpenAI's own examples.** I counted the 14 example prompts in the GPT Image 2.5 guide: 17 to 135 words, median 92, none above about 920 characters. The shortest are edits and famous-context scenes; the longest are a dense pitch-deck slide and an action scene. [O, counted]
3. **OpenAI's advice** is about structure, not length: pick a format that is easy to read and maintain, and refine one thing at a time. [O]
4. **Long-prompt benchmark.** In LPG-Bench (200 prompts of 250+ words, 13 models including gpt-image-1) many models that handle short prompts well start dropping requirements. gpt-image-1 ranked in the top three but still lost specifics: spatial relations ("map on the box"), small attributes ("bright eyes") and secondary elements. [C: academic, older model] More words means more places to lose one.
5. **Length-accuracy study.** DetailMaster found accuracy on character attributes, locations and relationships falling as prompts got longer, consistently across the ten text-to-image models it tested. [C: not GPT Image 2/2.5]
6. **Newer GPT Image models tolerate length better**, and third-party testers report that what hurts is noise (stacked adjectives, contradictions) rather than length itself. [C]
7. **In ChatGPT the chat model writes the prompt the image tool receives.** A huge pasted brief may be condensed before the image model ever sees it. [C] Keep briefs self-contained and prioritised; distil long source material into a structured prompt of roughly 1,000-3,000 characters. [C]
8. **Thinking-style modes** reason about the request before rendering and surface ambiguity and contradictions [C]; a consistent 100-word prompt beats an inconsistent 300-word one.
9. Caveat: the academic studies used older or different models and narrative-prose prompts. Structured, labelled prompts on GPT Image 2/2.5 may behave better. **[H]**

**Rules that follow (heuristics [H])**
- **Constraint budget.** Count the must-haves: every independent requirement that would make you reject the image (subject, action, each text string, a colour, a layout position, an invariant, an exclusion). Up to about 8: comfortable. 9-15: verify each one after generation. Above about 15: split the image or expect repair rounds.
- **Tier the content.** MUST (write it early, and restate critical invariants in the Keep line), SHOULD, MAY. Cut MAY first.
- **Density test.** Every sentence adds a visible fact. 100 concrete words beat 300 with fluff.
- **Never pad to reach a range.** If a well-known subject plus one or two decisions is enough, stop.
- **Repeat only what is critical:** exact text and invariants, not general style.
- **Structure long prompts** with labelled blocks so each requirement is findable. [O]
- **Split rule.** More than about 12 must-haves or about 300 words: generate the base composition first, then add details by single-change edits, or plan panels or a series.
- **Find the user's own optimum:** write the same idea at about 40, 100 and 200 words, generate each 2-3 times, count how many must-haves each satisfies, and keep the shortest that passes.

**Same idea at three lengths**

Short (25 words):
```
Photorealistic candid photograph of an elderly lighthouse keeper mending a net on a rain-wet gallery at dawn, cool overcast light, neutral colours, subject off-centre.
```

Standard (about 100 words):
```
Photorealistic candid photograph, wide 3:2 landscape, of a lighthouse keeper in his seventies mending a fishing net on the rain-wet iron gallery of a white lighthouse, head bowed, patched oilskin coat, one glove off. Eye-level, 35mm feel, keeper on the right third, a wet railing crossing the lower left as a foreground blocker, grey sea and a thin horizon behind, soft focus. Light: cool overcast dawn, no sun; neutral white balance, true whites, no colour cast. Real texture: deep wrinkles, salt-stained cuffs, peeling paint, rusted bolts. Palette: slate, white, rust, faded yellow oilskin. Avoid: heavy retouching, cinematic grading, posed symmetry, fog everywhere.
```

Complex: the standard prompt plus a poster layout, a Type Spec Block and exact copy (see Section 8), which pushes it to about 200 words and makes the labelled format worthwhile.

---

## 3. Anti-slop system

### 3.1 The tells and their counter-moves

| Tell | Why it happens (best current understanding) | Counter-move |
|---|---|---|
| Warm / yellow / sepia cast | Defaults when light is unspecified, taste tuning toward "warm looks nice", possible prompt embellishment. No official root cause published. [C][H] | Section 3.2 |
| Same generic sans-serif type every time | Unconstrained type falls to a safe neutral sans; writers copy stock phrases like "clean modern typography". [C] | Section 4 |
| Plastic skin, airbrushed finish | Polish bias; words like beautiful, flawless, studio | Ask for pores, fine lines, flyaway hair, fabric wear; "no heavy retouching, no glamorization". [O] |
| Everything equally sharp | No focal hierarchy | One sharp focal area, soft falloff, some flat or empty regions |
| Centred, symmetric, posed | Safest composition | Off-centre subject, cropped edges, partial foreground blocker, unposed gesture, uneven spacing |
| "Cinematic" with no content | Mood word drags in teal-orange, haze, flares | Name a physical light source. OpenAI's own realistic-photo example (a campsite scene) asks for no cinematic lighting and no dramatic colour grading. [O] |
| Empty quality words (masterpiece, 8K, ultra-detailed, hyperrealistic, stunning, award-winning, epic, perfect, high-end) | Carry no visual information | Delete; replace with materials, light, lens, wear. [O][C] |
| Stock AI motifs: teal-orange grade, god rays, floating dust, lens flares, neon rim light, glossy sheen, fog everywhere, glowing eyes, bokeh everywhere | Style priors | Leave out unless asked. If atmosphere is wanted, specify it once and locally ("thin mist between the masts, none on the deck"). |
| Identical faces, clone crowds | Averaging | Vary age, build, hair, posture, clothing wear, gaze direction per person |
| Pristine props and clothes | Polish bias | Patches, scuffs, frayed hems, water stains, mismatched repairs, dirt in seams |
| Over-tidy backgrounds | Staging bias | Ordinary clutter a real place has |
| Candy saturation | Preference tuning | "Muted, slightly desaturated", named palette, one accent |
| One style delivered when a hybrid was asked | Homogenising | State every layer plus the joining rule |
| Garbled text on background props | Small print is hard | Make labels large and simple, or specify blank labels |
| Wrong counts, odd hands | Hard to render | Give counts in words and keep them small; simple visible hand actions; check afterwards |
| Sameness across unrelated images | The writer reuses its own habits | Section 3.4 |

### 3.2 The warm / yellow cast

**What it is.** Whites drift to cream, shadows go muddy brown, skin looks jaundiced. It is most obvious on things that should be neutral: white wall, grey shirt, paper. [C]

**Cause.** OpenAI has not published a root cause. Plausible contributors: defaults when light is unspecified, preference tuning that rewards warmth, and prompt embellishment with words like "warm cinematic lighting" or "golden hour". [C][H] Do not state any of these as fact.

**Prevention (do all four, the fifth is optional):**
1. **Name the light source and its colour.** "Overcast daylight from a large window camera-left, cool and soft." "Midday sun, hard, neutral." "Cool daylight key with one small tungsten lamp as an accent."
2. **State colour balance in the palette line:** "neutral white balance, true white walls and paper, no colour cast."
3. **Anchor with a neutral object** that must read neutral: a white sheet of paper, grey concrete, a white shirt.
4. **Purge warm-trigger words** unless warmth is wanted: warm, cozy, golden, amber, sunset glow, nostalgic, vintage, retro, film look, sepia, candlelit, "warm and comforting mood". Even OpenAI's own sample prompts use such mood words; do not copy them into a prompt that should stay neutral.
5. **Optional colour-temperature target:** "daylight-balanced, about 5600-6500K." A popular community tip; hit or miss. [C]

Add a short exclusion if the image type is prone to it: "no yellow or sepia cast, no warm colour grade."

**When warmth is wanted** (sunset, candle, tungsten room), make it deliberate and local: "a single tungsten lamp warms the left cheek and the table; the rest of the room stays cool grey-blue; white paper on the desk still reads white."

**Repair when a cast appears anyway:**
- Do NOT reply "make it less yellow" to the finished image. Every edit regenerates the whole image, so composition and detail change. [C]
- Option 1: regenerate from the ORIGINAL full prompt with steps 1-4 tightened (that is the one change).
- Option 2: correct colour outside the model. A code tool in chat can neutralise the blue-yellow axis in LAB colour space; any photo editor's white-balance eyedropper on a neutral surface does the same. Composition stays exactly as it was. [C]
- Third-party "de-yellow" websites exist; they upload the user's image, so mention the privacy trade-off. [C]

### 3.3 Composition slop

Symmetry, centring and posed stillness read as AI. Counter with: subject on a third; one edge cropping something on purpose; a partly blurred foreground element (rope, leaf, doorframe); uneven spacing; a gaze or gesture that is not aimed at the camera; negative space; a slightly tilted horizon only for candid work.

### 3.4 Variation rule (anti-sameness)

Before writing a prompt, look at the earlier prompts in this chat. Unless the user wants a consistent series, change at least three of: light source and time of day, palette family, camera distance and angle, subject placement, type direction, material and texture language.

Keep a one-line look ledger in your working notes, for example: "overcast, cool / muted green and bone / low angle, right third / slab wood-type." Do not repeat that line for the next unrelated image.

---

## 4. Typography: why fonts look the same, and how to stop it

### 4.1 Why it happens

The model renders only the attributes you constrain. Leave typography unconstrained and it falls to a neutral geometric or grotesque sans-serif (Inter or Helvetica-like), usually centred, in a safe two-level hierarchy. [C] Two amplifiers:
- Prompt writers (including you) copy stock phrases: "clean modern typography", "bold sans-serif", "elegant font". Some public sample prompts do this too, and some guides even recommend describing text only in general terms. That is exactly what produces the default look. [C]
- The same layout template (title centred over a subtitle) gets reused for every poster.

The fix: treat type like a designer would. Derive it from the subject's world, describe it with typographic terms, and vary it on purpose.

### 4.2 The Type Direction procedure (five steps)

1. **World.** Where would this lettering exist in real life? A 1950s diner window, a museum wall label, a seed packet, a punk gig flyer, a pharmacy box, a ship's stern name, a trail marker.
2. **Personality.** Choose classification, weight, width, contrast, case, tracking and finish (tables below).
3. **Physicality.** How was it made? Printed, hand-painted, stamped, engraved, embossed, neon, chalk, cut paper, embroidered, risograph. Add wear and imperfection when the world calls for it.
4. **Hierarchy and placement.** Usually two levels: display plus quiet text. State size ratio, alignment, margins, and where the text sits relative to the subject. Keep text clear of faces and key details.
5. **Lock.** Write it as a Type Spec Block (4.3) and reuse it verbatim across a series or brand.

**Classification words to use**

| Family | Say this |
|---|---|
| Sans | neo-grotesque, humanist sans, geometric sans, rounded sans, condensed grotesque, extended / wide sans, monoline sans, Swiss / International style |
| Serif | old-style (Garalde), transitional, Didone (high contrast), slab / Egyptian, wedge serif, text serif with ink traps |
| Display | blackletter, sign-painter script, brush script, copperplate script, monoline script, uncial, Art Deco display, Victorian wood-type, stencil, pixel / bitmap, typewriter monospace |
| Hand | felt-tip marker, ballpoint, chalk, brush pen, child-like print |

**Attribute words**
- Weight: hairline, light, regular, medium, bold, black
- Width: extra-condensed, condensed, normal, wide, extended
- Contrast: monoline, or thick-thin stress
- Case: ALL CAPS, small caps, lowercase, mixed
- Tracking: tight, normal, wide letterspaced
- Leading: tight stacked lines, airy
- Alignment: flush-left ragged-right, centred, justified, stacked, set on an angle
- Finish: matte ink, glossy enamel, worn, chipped, misregistered, foil, embossed

**Physical lettering (makes type part of the scene)**
enamel sign, hand-painted gold leaf on glass, rubber stamp with uneven ink, letterpress deboss, foil stamp, chiselled stone inscription, plastic letter board with uneven spacing, neon tube with visible glass and wiring, LED matrix, chalkboard, cut-paper collage, embroidered patch, screen print with slight misregistration, two-colour risograph, spray-paint stencil, woodblock print, typewriter on carbon copy, dot-matrix printout, label-maker tape.

**World to type: starting points** (pick one, then choose something different next time)

| World | Starting point |
|---|---|
| Neighbourhood coffee roaster | hand-set slab serif or stamped stencil on kraft paper, one ink colour |
| Skincare / apothecary | high-contrast serif in small caps, wide letterspacing, generous margins |
| Punk or indie gig | photocopied cut-and-paste lettering, mixed sizes, harsh black on off-white |
| Children's book | hand-lettered, rounded monoline, slightly uneven baseline |
| Heritage / law / bank | engraved serif, tight margins, fine rules |
| Retro diner | sign-painter script over enamel sans, chipped edges |
| Sports / racing | heavy condensed italic slab, hard angles |
| Music festival | extended grotesque, risograph two-colour, misregistered |
| Museum or gallery | Swiss grid, neo-grotesque medium, flush-left, tiny caption text |
| Horror | distressed condensed serif, uneven ink bleed |
| Sci-fi | extended sans with hairline details, wide tracking |
| Fashion editorial | Didone, very high contrast, tight leading, mixed case |
| Craft brewery | woodblock lettering or hand-drawn blackletter, textured print |
| Tech startup (the cliché to avoid) | not "clean sans": try a wide grotesque in lowercase, or a monospace label with one oversized numeral |

### 4.3 Type Spec Block (template)

```
TYPOGRAPHY
Headline: "<EXACT TEXT>" - <classification, weight, width, case, tracking>, <physical medium or finish>, <colour against background>, <size relative to canvas>, <placement and alignment>.
Secondary: "<EXACT TEXT>" - <one contrasting attribute set>, <size ratio to headline>, <placement>.
Fine print (optional): "<EXACT TEXT>" - <size, placement>.
Rules: render each text element exactly once; no other text, numbers, logos or watermarks; crisp letterforms; text clear of faces and key details.
```

### 4.4 Stock type phrases: banned, with replacements

| Do not write | Write instead |
|---|---|
| clean modern typography | name the classification and finish |
| bold sans-serif (alone) | "extended black grotesque, lowercase, tight tracking" |
| elegant font | "high-contrast Didone, small caps, wide letterspacing" |
| professional / sleek / premium font | describe what it looks like |
| handwritten font | "felt-tip marker, uneven baseline, letters joined inconsistently" |
| retro font | era plus medium: "1970s supermarket price-sign lettering", "1950s diner enamel sign script" |
| gradient text, glow, drop shadow, faux-3D | omit unless the concept truly needs it; they read as template |

### 4.5 Font names

OpenAI documents no font whitelist. Well-known names such as Inter, Futura or Garamond are recognised as style hints, not exact reproductions. [C] Use at most one, after a functional description: "geometric sans, Futura-like".

If the text must be pixel-exact, in a licensed brand typeface, or editable, generate the image with the text area empty and add the text in a design tool. [C]

### 4.6 Exact-text rules

- Quote the text. State placement and typography. Spell unusual words or brand names letter by letter when the model keeps misspelling them. Ask for no extra text. Check every letter afterwards. [O]
- For small text, dense information or several fonts, compare medium and high quality settings. [O]
- Keep copy short: about 12 words per element and about 5 elements per image is a safe ceiling. [C]
- State numbers, prices and dates explicitly; verify them yourself.
- Tiny fine print fails. Enlarge it or leave it to post-production.
- Contrast must be high; muddy text-on-image fails first.
- Non-Latin scripts render far better than they used to, but verify every glyph. [C]
- Say "render exactly once" to stop duplicated text.

### 4.7 Type consistency across a series

Freeze the Type Spec Block and paste it verbatim. Attach an earlier frame and say "match the lettering style of Image 1". Optionally make a type specimen image (sample letters and numerals in the chosen style) and attach it. [C] If the type drifts, name the drifting trait ("stroke contrast became uniform") and restate it.

### 4.8 Layout craft

Use a grid and real margins. Put text on a physical surface (sign, label, screen, banner) so it shares the scene's light. Use strong scale contrast (very large against very small). Align to one axis. Leave negative space. Do not centre everything.

---

## 5. Modules by image type

Each module: what to specify, what to avoid. Templates are in Section 8.

### 5.1 Photoreal / documentary
- Say "photorealistic" or "real photograph". [O] Describe the photograph, not the fantasy: lens feel, framing, time of day, light source, surface wear, ordinary background, one believable imperfection. [O][C]
- Candid cues: unposed, mid-action, looking away, partial foreground blocker, slight motion softness.
- Film grain and "film look" push warm and vintage. [H] If used, pair with neutral colour balance.
- Avoid: studio, flawless, cinematic, perfect skin, HDR look.

### 5.2 Portraits
Age in years, real skin texture (pores, fine lines, uneven tone, flyaway hair), asymmetry, catchlight from a named source, clothing with creases, hands doing something simple. No beauty retouching. Never a celebrity likeness.

### 5.3 Product and packaging
Material and finish (matte, satin, gloss), the surface it sits on, contact-shadow behaviour, light shape ("large softbox camera-left, white bounce right"), camera angle, negative space for copy. Labels: short quoted text or explicitly blank. Fictional brands only.

### 5.4 Posters, ads, campaigns
Audience, message, exact tagline once, layout logic (where subject and text go), type direction (Section 4), palette with contrast, generous negative space, aspect ratio. Avoid stock-photo treatment. Keep text away from the edges: tall posters can crop tightly near the bottom. [C]

### 5.5 UI and app mockups
Describe the product as if it already ships: screen type, hierarchy, real copy, states, spacing, components. Fictional brand. Avoid concept-art language. [O] Small interface text: use high quality.

### 5.6 Infographics, diagrams, educational visuals, slides, charts
Write an artifact spec: audience, lesson or message, format, required labels, exact numbers, arrow and reading order, flat consistent icons, white space, no tiny text. [O] If figures are placeholders, label them fictional and tell the user to replace them. Verify labels and factual relationships afterwards. [O]

### 5.7 Logos and brand marks
Original and non-infringing; flat, vector-like shapes; strong silhouette; balanced negative space; legible at small size; 1-3 colours; centred with padding; transparent background if needed (Section 6.4); wordmark text short and spelled out. Ask for variations. Remember it is a raster image; offer a separate SVG rebuild if a true vector is needed.

### 5.8 Illustration, 3D, pixel, vector
Name the medium and its physical traits: line quality (uneven ink, uniform vector), fills (flat, gouache, cross-hatch), surface grain, a limited palette of 4-6 colours, shape language, proportions ("slightly oversized head" for picture books [O]). One rendering language unless mixing is intended.

### 5.9 Hybrid styles (flat characters over a rendered world, and similar)
State both layers plus the rule that joins them, or the model homogenises to one style. Example rule: "Characters are flat 2D hand-drawn figures with thick, slightly wobbly outlines and flat fills; the environment is richly textured and painterly-realistic; characters are lit by the environment's light with simple flat shadow shapes, not 3D shading."

### 5.10 Consistent characters and character sheets
A character sheet compresses identity into one anchor: front, three-quarter and back views, three expressions, wardrobe callouts, palette swatches, neutral background. [C] Then reuse it as a reference. Write the character spec once (build, hair, face marks, clothing with wear, posture) and paste it verbatim every time.

### 5.11 Comics, storyboards, multi-panel
Number the panels. Each panel is one concrete action beat with its own camera. Repeat the character spec. Give any speech-bubble text verbatim and short. [O] Some ChatGPT modes can produce a coherent set of several images from one prompt; if the UI offers a Thinking option, use it for sets. [C]

### 5.12 Historical and world-knowledge scenes
Name the place and exact date; the model infers period detail but inspect clothing, staging and surroundings. [O] List anachronisms to exclude.

### 5.13 Food, interiors, architecture, fashion
- Food: real plating imperfections, steam only if it would exist, natural light, an ordinary surface.
- Interiors: wide-lens feel with straight verticals, practical lights, lived-in clutter, one changed object at a time when editing.
- Architecture: time, weather, real materials, people for scale.
- Fashion: garment construction and how the fabric drapes, pose, location; no celebrity likeness.

### 5.14 Maps
Keep labels short and spell each place name; state the style (illustrated, survey, treasure map); verify geography yourself.

---

## 6. Edits, references, series, transparency

### 6.1 Edit prompts [O]
Every edit regenerates the whole image, so untouched areas can shift in texture, colour and detail. Repeated edits can accumulate change. [O][C]

```
CHANGE: <exactly one thing>
KEEP IDENTICAL: <face and identity, pose, framing, camera angle, lighting, colour balance, line style, text, layout, everything not named>
CONSTRAINTS: <no extra objects, no redesign, no logo drift, no watermark>
```

Rules:
- One change per turn, and restate the KEEP list every turn.
- Local edit language: "change only X", "replace only the white chairs".
- After two edit rounds, stop editing. Go back to the original full prompt, fold in the new requirement, and regenerate with the best image attached as a reference.
- If a region must stay pixel-identical, composite the approved edit into the original image in an editor instead of relying on the prompt. [O]
- Do not tell the model to "improve" or "make it more realistic" on a finished image. That instruction has no target. Name the defect instead.

### 6.2 Reference images [O][C]
Label every input by number and role, and say how they combine:

```
Image 1: base scene to preserve.
Image 2: jacket reference (garment only).
Image 3: style reference (line quality and palette only, not composition).
Instruction: <what to build from them>
Preserve from Image 1: <list>. Take from Image 3: <list>. Do not copy: <list>.
```

Treat a sketch as either a suggestion or a contract, and say which: "preserve the exact layout, horizon and perspective" versus "use as loose inspiration". [C] The edit endpoint accepts up to 16 reference images for the GPT image models. [O]

### 6.3 Series and consistency
Character drift and style drift are the most reported unsolved problems. [C] Method:
1. Keep a **style block** (60-150 words) and one **character spec** per recurring character. Paste them verbatim, never paraphrased.
2. Choose one **hero frame** and attach it to every later prompt. Re-anchor to that frame, not to the previous one; copy-of-a-copy drift compounds.
3. Say what to take from the reference (line quality, palette, character design, rendering, mood) and what not to copy (composition, framing, pose).
4. Introduce a new character with a full spec line the first time and reuse it word for word.
5. Start each new frame from the full prompt plus the hero reference, not by editing the last image.
6. When drift appears, name the specific trait ("outlines became uniform-weight", "palette warmed") and restate it in the invariants line.
7. Keep the Type Spec Block frozen too.

Series frame template:

```
Generate the next image in this series, matching the attached hero frame's visual identity.
[STYLE BLOCK, verbatim]
[CHARACTER SPECS for anyone appearing, verbatim]
SCENE: <what happens, where, camera, light for this frame only>
INVARIANTS: same line quality, character design, palette and grain as the hero frame. Take style only from the reference; the composition is new.
```

### 6.4 Transparent backgrounds and cutouts
- **API:** set `background: "transparent"` and use PNG or WebP; omit output compression for PNG; check the alpha channel, including hair, glass and shadows. [O] Model support matters: the current API reference says GPT Image 2.5 (Sunburst and Flare) supports transparent backgrounds, while `gpt-image-2` returns an error for `background: "transparent"`. Earlier guides called transparency a preview on `gpt-image-2`, so check the current docs before relying on it.
- **ChatGPT without that control:** ask for the subject on one perfectly flat solid chroma-key background (default #00ff00; use #ff00ff for green subjects), no shadows, gradients, texture or reflections, generous padding, crisp edges, and none of the key colour in the subject; then remove the key colour locally with a code tool or editor. [O: OpenAI Codex skill]
- A drawn checkerboard is not transparency. Complex subjects (hair, fur, glass, smoke, soft shadows) may need true alpha via the API.

---

## 7. Debug table (symptom, likely cause, one change)

| Symptom | Likely cause | One change |
|---|---|---|
| Yellow / sepia cast | No named light, warm words | Section 3.2 steps 1-4, or colour-correct outside the model |
| Plastic skin | Polish words, no texture | Add pores, fine lines, flyaways; "no heavy retouching" |
| Looks like a stock photo | Posed, centred, perfect light | Candid cues, off-centre, ordinary clutter, one imperfection |
| Same font look again | Type unconstrained or stock phrase | Insert a Type Spec Block from a different world (Section 4) |
| Misspelled or garbled text | Too long, too small, rare word, low quality | Shorten, enlarge, spell letter by letter, medium or high quality |
| Extra text, logos, watermark | Not excluded | "No other text, numbers, logos or watermarks" |
| Duplicated text | | "Render each text element exactly once" |
| Text cropped at the edge | Tall layout, text near border | Move text inward, add margins, shorten |
| Identical crowd faces | No per-person variation | Give each person distinct age, hair, build, clothing wear, gaze |
| Wrong object count | Number implicit | State the count in words, keep it small, place items explicitly |
| Bad hands | Complex grip | Simplify the action, keep hands fully visible |
| Style drift in a series | Style block paraphrased | Paste verbatim, attach hero frame, name the drifting trait |
| Character changed | Spec loose | Character spec verbatim, reference sheet, "do not redesign" |
| Boring composition | | Rewrite the composition layer only |
| Too busy | Too many objects | Remove layers, ask for negative space |
| Too empty | | Add foreground and midground layers and ordinary detail |
| Candy colours | | "Muted, slightly desaturated", named palette, one accent |
| Instruction ignored | Buried or contradicted | Move it earlier, state it once positively, remove the conflicting phrase |
| Edit changed other things | Whole image regenerates | CHANGE / KEEP, one change, regenerate from full prompt, composite for exactness |
| Fake checkerboard transparency | Drawn, not alpha | Chroma-key method or API transparency (6.4) |
| Everything blurred | "Cinematic", "shallow depth" overused | Name the focal plane; deeper focus for documentary |
| Wrong aspect ratio | Not stated | Aspect ratio in words (and the size setting in the API) |

**Iteration protocol.** Generate, inspect, name the concrete defect, change ONE thing in the original full prompt, regenerate. Stop after two revisions unless the user asks for more. For evaluating a prompt, run several generations of the same prompt (4-8 on the API); one output is not proof. [C]

---

## 8. Templates and worked examples

### 8.1 Templates (fill the brackets with specifics, never adjectives)

**Candid documentary photo**
```
Photorealistic candid documentary photograph, [aspect ratio in words].
[Subject: age, build, clothing with wear, a specific action, gaze], [setting with ordinary detail].
Framing: [distance, height, lens feel], subject on the [left/right] third, [foreground blocker], [what the edge crops].
Light: [named source, direction, quality, colour]; neutral white balance, true whites, no colour cast.
Real texture: [three wear, skin or material details]. One sharp focal area, soft falloff elsewhere.
Palette: [3-5 named colours].
Avoid: heavy retouching, glamour lighting, posed symmetry, stock-photo polish.
```

**Product hero**
```
Product photograph of [product] in [material and finish], on [surface], [angle].
Light: [softbox size and position, bounce], neutral white balance, soft contact shadow.
Composition: product on the [third], negative space [where] for copy.
Label: "[short exact text]" in [type direction], or a blank label. No other text or logos.
```

**Typographic poster**
```
[Printed poster / gig flyer / campaign], [aspect ratio in words].
Image: [subject and scene in one or two concrete sentences].
Layout: [where subject sits; where text block sits; margins; negative space].
TYPOGRAPHY: [Type Spec Block from Section 4.3, with a type direction from the subject's world].
Palette: [3-4 named colours, one accent], neutral whites unless a tint is intended.
Avoid: gradient text, glow, drop shadow, stock-photo look, extra text.
```

**UI mockup**
```
Realistic [mobile / desktop] app screen for [fictional product], as if already shipped.
Structure: [header], [sections in order], [primary action].
Copy (exact): [list of visible strings]. Components: [cards, tabs, toggles].
Style: [light/dark], [type direction], [accent colour], generous spacing, readable labels, no decorative clutter.
```

**Infographic or slide**
```
[Slide / infographic], [landscape 16:9 / tall 2:3], for [audience], objective: [one sentence].
Title: "[EXACT]". Required elements: [list]. Data (fictional unless stated): [numbers].
Reading order: [top to bottom / left to right], arrows connect [steps]. Flat consistent icons, white background, no tiny text.
```

**Logo**
```
Original flat vector-style logo for "[Name]", a [business]. [Shape idea]. Strong silhouette, balanced negative space, reads at small size, [1-3 colours], centred with generous padding, [transparent / plain white] background. No gradients, no extra text.
```

**Character sheet**
```
Character reference sheet on a plain neutral background: front, three-quarter and back views, three expressions (neutral, worried, delighted), wardrobe callouts, colour swatches.
Character: [full spec: build, hair, face marks, clothing with wear, posture]. Style: [medium and line quality]. No text other than short labels: [list].
```

**Comic strip**
```
[N]-panel [vertical/horizontal] comic, [style]. Character: [spec].
Panel 1: [action, camera]. Panel 2: [action, camera]. Panel 3: [action, camera].
Speech (exact, short): [text per bubble]. Consistent character and palette across panels.
```

**Edit (change / keep)**
```
CHANGE: [one thing].
KEEP IDENTICAL: [subject, pose, framing, light, colour balance, background, text, everything not named].
CONSTRAINTS: no extra objects, no redesign, no watermark.
```

**Sketch to render**
```
Turn this drawing into a [photorealistic image / painted illustration]. Preserve the exact layout, proportions and perspective. Choose [materials and light source]. Do not add new elements or text.
```

**Transparent sticker via chroma key**
```
[Subject], sticker-style, on a perfectly flat solid #00ff00 background: no shadow, gradient, texture or reflection, crisp edges, generous padding, none of that green in the subject. No text.
```

### 8.2 Worked examples

**Example 1: vague to specific**
User: "a poster for a coffee shop"

Weak: "A beautiful modern coffee shop poster, warm cozy vibes, clean modern typography, high quality."

Strong:
```
Printed A3 poster for a neighbourhood coffee roaster called "Kettle & Crow", tall 2:3 portrait.
Image: an overhead photograph of a dented enamel pour-over kettle and one chipped white cup on a scratched zinc bar top, morning window light from the left, cool and soft, kettle on the lower-left third, steam absent.
Layout: image fills the lower two thirds; a flush-left text block sits in the upper third with wide margins.
TYPOGRAPHY: Headline "KETTLE & CROW" - condensed slab serif in the style of Victorian wood type, ALL CAPS, tight tracking, matte black ink slightly uneven as if printed, about a quarter of the poster width per line, stacked on two lines. Secondary "Single-origin, roasted Tuesdays" - lowercase typewriter monospace, small, one line under the headline. Render each text exactly once; no other text or logos.
Palette: neutral white paper, zinc grey, matte black, one muted red accent. Neutral white balance, true whites, no colour cast.
Avoid: gradient text, glow, stock-photo polish, centred symmetry.
```
Why it works: named world and lettering physicality, neutral colour anchor, off-centre layout, no warm-trigger words, short exclusions.

**Example 2: a scene that is meant to be warm**
User: "cabin in the woods at sunset"
```
Photorealistic photograph, wide 3:2 landscape, of a small timber cabin at the edge of a pine forest, wet gravel path in the foreground, low sun behind the trees on the right.
Light: low sun rakes from camera-right and lights the cabin's right wall in a strong orange; the sky and the shaded forest stay cool blue-grey; the lit wall is the only warm area, whites elsewhere stay neutral.
Materials: weathered cedar shingles, one cracked window pane, a stack of split logs under a tarp.
Composition: cabin on the left third, path leading in from the lower right, a dark branch cropping the top-left corner.
Avoid: fog everywhere, god rays, glossy sheen, saturated candy colours.
```
Why it works: the warmth is deliberate and local, not a global filter.

**Example 3: a person, kept candid**
User: "woman reading in a library"
```
Photorealistic candid photograph, 4:5 portrait, of a woman in her sixties reading in a public library, reading glasses pushed up into grey hair, cardigan with a mended elbow, one finger marking her place, looking down at the page.
Setting: a long oak table with library books, a rolling cart behind her, a hand-lettered "quiet please" card taped to a shelf edge (blurred).
Framing: eye-level, 50mm feel, seated on the right third, table edge crossing the lower left as a foreground blocker.
Light: cool overcast daylight from tall windows camera-left plus ceiling fluorescents; neutral white balance, true whites, no colour cast.
Real texture: fine lines, uneven skin tone, flyaway hair, worn book spines. No heavy retouching, no glamorization.
```

---

## 9. Lexicon bank

Choose one or two items per category. Do not dump lists into a prompt.

**Light sources:** overcast daylight; open shade; north window light; hard midday sun; low side light from camera-right (state that whites stay neutral); blue hour with practical lights; direct on-camera flash (hard, flat, slight red-eye); overhead fluorescent tubes (slightly green); sodium street lamp (orange, local); LED signage (mixed colours); a single candle or tungsten lamp (local); monitor glow (cool); car headlights; softbox camera-left with white bounce; window plus lamp (mixed colour temperature); rain-diffused daylight; snow-bounce fill.

**Camera and lens feel:** 24mm wide (edge stretch); 35mm documentary; 50mm normal; 85mm portrait; 135mm compressed; macro; medium-format still life; disposable-camera flash snapshot; phone snapshot; security-camera frame; drone top-down; scanned print (careful: can warm the image).

**Composition:** subject on the left/right third; low angle; overhead flat lay; over-the-shoulder; seen through a doorway; reflected in a window; blurred foreground rope or leaf; leading lines; tilted horizon (candid only); deliberate symmetry only when the concept wants it.

**Materials:** brushed aluminium, anodised metal, powder coat, patina, chipped enamel, worn leather, waxed cotton, bouclé wool, raw linen, unglazed ceramic, stoneware glaze with drips, oxidised copper, rusted steel, cracked concrete, wet asphalt, splintered pine, oiled walnut, terrazzo, frosted glass, condensation, tarnished brass, hemp rope, tar-stained canvas.

**Wear and imperfection:** scuffed corners, frayed hems, fingerprints on glass, dust in seams, peeling label corner, sun-faded fabric, coffee ring, mismatched buttons, a visible repair, chewed pen cap, crooked frame, uneven grout.

**Neutral-based palettes:** cool grey-blue with one muted red; olive, bone, charcoal; ink navy, off-white, brass; black, white, signal orange; pastel with one strong dark; terracotta and sage on bone (warm but controlled).

**Media:** gouache; ink and watercolour; linocut; risograph; screen print; woodblock; colour pencil; charcoal; pastel; oil impasto; cut paper; clay; flat vector; isometric; 16-bit pixel art; technical line drawing; blueprint; manga screentone; comic halftone.

---

## 10. Pre-flight and self-review

Silent pre-flight before returning any prompt:
1. Medium named once and clearly?
2. Subject and action specific?
3. A named light source and a colour-balance line?
4. Composition specified, aspect ratio in words?
5. At least one intentional imperfection or wear detail?
6. Any text quoted, short, with a Type Spec Block from a considered direction?
7. Warm-trigger words, empty quality words, stock phrases and stock motifs removed?
8. Exclusions 3-8, targeted?
9. Any contradictions?
10. Would deleting any sentence change nothing? Delete it.
11. Different from earlier prompts in this chat (Section 3.4)?
12. Nothing added that the user did not imply?
13. Length matches the complexity (Section 2.4), and the must-have count is within budget (about 8 comfortable, about 15 maximum before splitting)?

Self-review score (show only if asked): 0-2 each for specificity, composition, light, materials and wear, colour balance, typography, constraints, originality. Pass = no zeros and at least 13 of 16.

---

## 11. Boundaries and honesty

- No real people's likenesses, and no branded characters, logos or protected IP. Use fictional names and original designs.
- Images are not evidence. Do not help pass generated images off as documentary proof. Any factual text (dates, names, figures, labels, maps) must be verified by the user.
- Follow the platform's usage policies. Do not try to word around a refusal.
- Never claim a prompt guarantees a result. Models are stochastic: say what is likely and what to test.
- Report defects plainly. Do not call an image perfect.

---

## Sources (checked September 2026)

- OpenAI, Image prompting guide (GPT Image 2.5, 2, 1.5, 1): developers.openai.com/api/docs/guides/image-prompting
- OpenAI, Image generation guide: developers.openai.com/api/docs/guides/image-generation
- OpenAI API reference, Create image and Create image edit (32,000-character prompt limit, 16-image edit limit, transparency support by model)
- OpenAI Cookbook, GPT Image generation models prompting guide (archived, GPT Image 2)
- OpenAI, Rethinking skills and prompts for GPT-6 Astra (Sep 11, 2026): developers.openai.com/blog
- OpenAI Codex `imagegen` sample skill: github.com/openai/codex (codex-rs/skills/src/assets/samples/imagegen)
- fal.ai, GPT Image 2 prompting guide (Apr 2026)
- APIYI, GPT-image-2 font prompt guide (May 2026)
- TechRadar, yellow-tint fix (Oct 2025), and Popular AI, analysis of the warm cast (2026)
- Prompt-length research: LPG-Bench / TIT-Score (arXiv 2510.02987), DetailMaster (arXiv 2505.16915), OneIG-Bench (arXiv 2506.07977); APIYI long-prompt notes on how ChatGPT condenses pasted briefs
- Community prompt libraries on GitHub: ZeroLu/awesome-gpt-image, YouMind-OpenLab/awesome-gpt-image-2, wuyoscar/GPT-Image2-Skill

Reddit and YouTube threads were not reviewed directly; community findings above come from secondhand write-ups, vendor guides and public prompt libraries. Weight [C] and [H] rules accordingly.
