# HyperSignal — trading dashboard

Application web (**Hyperliquid**) : scan d’opportunités, plan multi‑TF, niveaux SL/TP.

**Site public (GitHub Pages)** — après activation ci‑dessous et premier déploiement réussi :

**https://0xDOCTEUR.github.io/HyperSignal---trading-dashboard/**

---

## Développement local

```bash
npm install
npm run dev
```

---

## GitHub Pages (lien public)

1. Sur le dépôt GitHub : **Settings** → **Pages** → **Build and deployment**.
2. **Source** : choisir **GitHub Actions** (pas « Deploy from a branch »).
3. Pousser sur `main` : l’action **Deploy GitHub Pages** construit et publie automatiquement.
4. Attendre 1–2 minutes puis ouvrir :  
   **https://0xDOCTEUR.github.io/HyperSignal---trading-dashboard/**

Si tu renommes le dépôt, mets à jour `GH_PAGES_BASE` dans `vite.config.ts` pour qu’il corresponde au nouveau nom (`/<nom-du-repo>/`).

---

<details>
<summary>Ancienne doc du template Vite (optionnel)</summary>

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

</details>
