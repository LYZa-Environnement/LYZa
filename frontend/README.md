# LYZa — frontend

Site React (Vite + TypeScript). Voir le README à la racine du dépôt pour
l'architecture d'ensemble et la mise en route du backend.

```bash
npm install
npm run dev
```

Le serveur de dev proxie `/api/*` vers `http://127.0.0.1:8000` (voir
`vite.config.ts`) — lancer le backend (`../backend`) en parallèle pour que
la page "Évaluer un site" fonctionne.
