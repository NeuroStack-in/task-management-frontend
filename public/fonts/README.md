# PDF export fonts

Self-hosted [Noto](https://notofonts.github.io/) fonts for the PDF exports (employee report,
employee list, project report, insights reports). They are fetched **only when a report contains
text outside Latin-1** — a Latin-only report never requests anything from this folder. See
`src/modules/employees/lib/pdf-text.ts` (which string goes which way) and `pdf-fonts.ts` (loading).

Served from our own origin on purpose: a third-party font CDN would learn when someone exported a
report, and from where.

## How they are used

- **`NotoSans-*.ttf`** — Latin, Greek and Cyrillic beyond Latin-1 (Łukasz, Ελένη, Дмитрий, ₹, №).
  Embedded into the PDF by jsPDF as real, selectable text; jsPDF writes only the glyphs used.
- **`NotoSans<Script>-Regular.woff2`** — loaded with `FontFace` for scripts that need shaping
  (Indic, Arabic, Hebrew, Thai). jsPDF can't shape, so the browser draws those strings on a canvas
  and they are placed in the PDF as images. Bold is synthesised by the browser.
- **Not included: CJK** (Chinese, Japanese, Korean — ~17 MB a family) and other scripts. Those are
  drawn the same way with whatever font the system has; with none, the browser shows its own
  fallback boxes, exactly as it would on screen.

## Files

Originals: `https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/<Family>/unhinted/ttf/<File>.ttf`,
downloaded 2026-10-09.

| File | Bytes | Version | Original TTF (bytes) | SHA-256 of the original |
|---|---:|---|---:|---|
| NotoSans-Regular.ttf ¹ | 249,336 | 2.015 | 431,364 | `f3961a9cde016d41a4879aecda1474d3a36d6bf54fa0e4643de029cc2248b0e8` |
| NotoSans-Bold.ttf ¹ | 249,784 | 2.015 | 432,376 | `87cb2d84472a7d66da659ee47b6cdb9552326e8c128245231f191b6ac72529d9` |
| NotoSansArabic-Regular.woff2 | 49,556 | 2.013 | 142,140 | `bd86ca02f087d7f3c3788ba458fb6b73744c7639ed276b8d870dba6def6c40d0` |
| NotoSansBengali-Regular.woff2 | 43,048 | 3.011 | 103,704 | `5dceda02816fece18ea6796f474f5d3170f1d862f21b1e809cdc94b1caa4b6ec` |
| NotoSansDevanagari-Regular.woff2 | 54,512 | 2.007 | 184,228 | `9c7d935139ea6a1e6ad9dbac4f6d27ece1e04bca8123c8888d00a0f9df4724cd` |
| NotoSansGujarati-Regular.woff2 | 38,424 | 2.106 | 142,760 | `18727143b8eadade0a59dca80959ef784bf8d55e07285d1b4096594dbf829f0a` |
| NotoSansGurmukhi-Regular.woff2 | 14,708 | 2.004 | 35,956 | `2454c944fda799d2861f11c03e492c453e33083dd1e8d99bd6baac8de71ad0f0` |
| NotoSansHebrew-Regular.woff2 | 6,924 | 3.001 | 16,836 | `04272f5600d0ec816d31d0df73b23aa8d3501ea359ebe820da31c11ffcf00853` |
| NotoSansKannada-Regular.woff2 | 36,252 | 2.006 | 135,488 | `2870274619c2a4abe5d6b11fcb7c4a372eba765b6b7881d459b0eb0a609a68eb` |
| NotoSansMalayalam-Regular.woff2 | 27,012 | 2.104 | 77,312 | `cc39bb1f7d63b582a2aec1abf2469a43b805a3523a27e0a0eee8cd32702541d5` |
| NotoSansOriya-Regular.woff2 | 41,704 | 2.007 | 131,216 | `a16645d056017927406546aa78e4ce15e782fd8783467267b75450453d007415` |
| NotoSansSinhala-Regular.woff2 | 28,892 | 3.000 | 90,296 | `46d5b54952a624e6e3981e0968aecc5464f3b1081131dd7a1fcd42fbf7966471` |
| NotoSansTamil-Regular.woff2 | 17,632 | 2.004 | 46,600 | `6634d9cc97a726e670df41281dd32b167a6b9b71f2036e19671ff08fdde0c292` |
| NotoSansTelugu-Regular.woff2 | 44,500 | 2.005 | 165,212 | `dcb86a5da09365a2d73d725e429403dca988e6d50c1b1d564579a25dbc18bd29` |
| NotoSansThai-Regular.woff2 | 9,224 | 2.002 | 20,960 | `d4303fe9c63ebb72759ca8b6d2040c8ae81689f7d08d7b91c656154382b49313` |
| **Total** | **911,508** | | | |

¹ Slimmed with fontTools 4.66: every character the original maps is kept (2,965 code points), the
OpenType layout tables are dropped because jsPDF never applies them, and every `name` record —
copyright and licence included — is kept:

```python
from fontTools import subset
from fontTools.ttLib import TTFont

font = TTFont("NotoSans-Regular.ttf")
opts = subset.Options()
opts.layout_features = []
opts.drop_tables += ["GSUB", "GPOS", "GDEF"]
opts.name_IDs, opts.name_languages, opts.name_legacy = ["*"], ["*"], True
opts.notdef_glyph = opts.notdef_outline = True
s = subset.Subsetter(opts)
s.populate(unicodes=font.getBestCmap().keys())
s.subset(font)
font.save("NotoSans-Regular.ttf")
```

The `.woff2` files are the original TTFs re-wrapped unchanged (`font.flavor = "woff2"; font.save(...)`).

## Licence

SIL Open Font License 1.1 — see [OFL.txt](OFL.txt), which carries each family's copyright line.
