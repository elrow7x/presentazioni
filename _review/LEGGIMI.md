# Revisione al volo

Strumento di revisione per le anteprime dei clienti, riusabile in ogni progetto e pagina.

## Aggiungerlo a una pagina
```html
<link rel="stylesheet" href="/_review/review.css">
<script src="/_review/review.js" data-progetto="acquolina" data-pagina="home" data-titolo="Acquolina · Homepage" defer></script>
```
Una cartella per pagina: `/<progetto>/<pagina>/index.html`.

## Come arrivano le revisioni
- Netlify Forms, modulo `revisioni` (definito in `form.html`). Ogni invio contiene tutte le voci di quella persona per quella pagina: vale l'ultimo.
- Campi: progetto, pagina, autore, url, approvati, da_cambiare, riepilogo (leggibile), voci (JSON con tipo, stato, selettore, sezione, originale, foto, correzione).
- Claude le legge dal connettore Netlify (progetto `presentazioni-roberto`) e applica le correzioni.
