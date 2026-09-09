# Lapsi — brand kit v1

Wordmark in **Monoton**, con la "a" sostituita da un cronometro stilizzato
(corona in alto, doppio tratto "inline" del font, due lineette verticali a destra
che chiudono la lettera, lancetta accento in Flare).

## Cosa usare dove
- **Lockup completo** (`lapsi-logo-*.svg`, PNG di riserva): header del sito, login, email, presentazioni. Larghezza minima 120 px.
- **Marchio** (`lapsi-mark-*.svg`): avatar app, favicon, loader, watermark. Sotto i 24 px usa SEMPRE il marchio, non il lockup.
- **Mono** (`*-mono-*.svg`): stampa a un colore, incisioni, watermark. Nessun accento.
- Il payoff *Track. Time. Analyze.* si usa solo sopra i 180 px di larghezza.

## Colori
| Token | Hex | Uso |
|---|---|---|
| Ink 900 | #0E0D12 | fondo app |
| Surface 800 | #141320 | card, superfici |
| Line | #232130 | bordi |
| Bone 50 | #E8E4D9 | testo, marchio |
| Flare | #FF5C3A | accento, lancetta, CTA |
| Flare Deep | #C4381A | accento su fondo chiaro |
| Muted | #9A97A3 | testo secondario |

## Font
- Monoton — **solo logo**, mai UI.
- Archivo — UI, titoli (400/500/600).
- JetBrains Mono — timer e durate (cifre tabellari).

## Integrazione
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/favicon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0E0D12">
<link rel="stylesheet" href="/lapsi-tokens.css">
```

## Da non fare
- Non ruotare, inclinare o allungare il marchio.
- Non cambiare i colori delle lancette (accento sempre e solo sulla lancetta lunga).
- Non aggiungere ombre, contorni o gradienti.
- Spazio libero minimo attorno al logo: l'altezza della "l".

## SVG
`lapsi-logo-{light,dark,mono-light,mono-dark,onblack}.svg` e `lapsi-logo-payoff-{light,dark}.svg`:
lettere **convertite in tracciati** (nessun font da caricare), fondo trasparente tranne `onblack`.
Scalano a qualsiasi dimensione e funzionano in `<img>`, CSS `background`, Figma e Illustrator.
