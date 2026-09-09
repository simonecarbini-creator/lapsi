# RUN Tracker

Applicazione web mobile per registrare atleti, tempi e dati di inserimento.

## Contenuto

- Form con Nome, Cognome e Time
- Time con campi separati per hh, min, sec e decimi
- Inserimento automatico della data e dell'ora di registrazione
- Salvataggio locale nel browser con `localStorage`
- Esportazione dei dati in file JSON
- Supporto PWA per installazione come app sul tuo iPhone

## Come aprire localmente

Da terminale, nella cartella del progetto:

```bash
cd /Users/simonecarbini/WEB-APPS/RUN
python3 -m http.server 8000
```

Poi apri nel browser:

```text
http://localhost:8000
```

## Come usarla da iPhone

1. Apri la pagina dal tuo dominio o dal tuo server locale.
2. Sul browser Safari, premi il pulsante di condivisione.
3. Seleziona "Aggiungi alla schermata Home".
4. L'app verrà installata come una vera app nativa sul tuo iPhone.

## Publicazione su dominio

Carica tutti i file della cartella in una cartella pubblica del tuo hosting, ad esempio:

- Netlify
- Vercel
- Cloudflare Pages
- hosting web classico con FTP

Se il sito è in root del dominio, la pagina principale sarà:

```text
https://tuo-dominio.it/
```

## Dati salvati

I dati vengono salvati nel browser dell'utente tramite `localStorage`.
Per esportarli in JSON usa il pulsante "Esporta JSON" della pagina.

## Nota importante

Questa versione salva i dati solo sul dispositivo dove viene usata. Se in futuro vuoi che più persone registrino dati dallo stesso dominio e che i dati siano sincronizzati tra dispositivi, allora serve un backend con database (ad esempio Node.js + SQLite/PostgreSQL o Firebase).
