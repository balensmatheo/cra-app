# CRA App - Gestion des Compte Rendus d'Activité

## 📋 Contexte

Nous sommes **XNDATA**, une petite ESN de moins de 20 salariés.

Chaque salarié effectue une ou plusieurs missions chez des clients différents. À la fin de chaque mois, le salarié doit remplir un fichier Excel contenant les informations suivantes :

### Activités facturées
- Prestation de formation
- Prestation régie / expertise

### Activités non facturées
- Auto-formation
- Formation interne
- Inter-contrat
- Journée séminaire, sortie
- Projet client
- Projet interne

### Autres
- Absence autorisée
- Congé
- Maladie / Arrêt
- RTT

Cette application web permet de faciliter la gestion des compte rendus d'activité en offrant une interface moderne et intuitive pour saisir les données avant export vers Excel.

## 🚀 Fonctionnalités

- **Interface intuitive** : Saisie facile des activités par jour avec validation automatique
- **Gestion des catégories** : Ajout/suppression dynamique de catégories d'activités
- **Sauvegarde automatique** : Données sauvegardées localement dans le navigateur
- **Export Excel** : Génération automatique du fichier Excel final basé sur un template
- **Validation des données** : Contrôles de cohérence et alertes en temps réel
- **Interface responsive** : Compatible desktop et mobile
- **Mode plein écran** : Optimisation de l'espace de travail

## 🛠️ Technologies utilisées

- **Frontend** : Next.js 15 avec React 18
- **UI Framework** : Material-UI (MUI) v5
- **Langage** : TypeScript
- **Export Excel** : Bibliothèque xlsx
- **Build** : Turbopack pour le développement

## 📦 Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation des dépendances
```bash
npm install
# ou
yarn install
```

### Lancement en développement
```bash
npm run dev
# ou
yarn dev
```

L'application sera accessible à l'adresse [http://localhost:3000](http://localhost:3000)

### Build de production
```bash
npm run build
npm start
```

## 📖 Utilisation

### 1. Configuration initiale
- Saisissez votre nom dans le champ "Nom"
- Sélectionnez le mois et l'année pour le compte rendu

### 2. Saisie des activités
- **Activités facturées** : Saisissez les prestations de formation et régie/expertise
- **Activités non facturées** : Renseignez les formations, projets internes, etc.
- **Autres** : Indiquez les congés, absences, RTT

### 3. Valeurs acceptées
- `0.25` : Quart de journée
- `0.5` ou `0.50` : Demi-journée  
- `0.75` : Trois quarts de journée
- `1` : Journée complète
- Les weekends sont automatiquement désactivés

### 4. Commentaires
- Ajoutez des commentaires pour préciser le client, l'activité, etc.
- Les commentaires sont sauvegardés avec les données

### 5. Export Excel
- Cliquez sur "Exporter Excel" pour générer le fichier final
- Le fichier sera téléchargé au format `CRA_[Nom]_[Mois].xlsx`

## 🗂️ Structure du projet

```
cra-app/
├── app/                    # Pages Next.js (App Router)
│   ├── globals.css        # Styles globaux
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Page principale
├── components/            # Composants React
│   ├── ActivityTable.tsx  # Tableau d'activités
│   └── Navbar.tsx         # Barre de navigation
├── utils/                 # Utilitaires
│   └── exportExcel.ts     # Logique d'export Excel
├── public/                # Assets statiques
│   └── cra_template.xlsx  # Template Excel
└── package.json           # Dépendances et scripts
```

## 🔧 Configuration

### Variables d'environnement
Créez un fichier `.env.local` à la racine du projet si nécessaire :

```env
# Variables d'environnement spécifiques
NEXT_PUBLIC_APP_NAME=CRA App
```

### Template Excel
Le fichier `public/cra_template.xlsx` contient le template de base pour l'export. Les marqueurs suivants sont supportés :
- `{{NOM}}` : Nom du salarié
- `{{MOIS}}` : Mois/année sélectionné
- `{{ACTIVITES_FACTUREES}}` : Point d'injection des activités facturées

## 💾 Sauvegarde des données

Les données sont automatiquement sauvegardées dans le localStorage du navigateur avec la clé :
```
cra_sections_[Nom]_[Mois]
```

**Note** : Les données sont stockées localement dans le navigateur. Pensez à exporter régulièrement vos données.

## 🐛 Dépannage

### Problèmes courants

1. **L'export Excel ne fonctionne pas**
   - Vérifiez que le fichier `cra_template.xlsx` est présent dans le dossier `public/`
   - Assurez-vous que toutes les catégories ont un nom

2. **Les données ne se sauvegardent pas**
   - Vérifiez que le localStorage n'est pas désactivé dans votre navigateur
   - Essayez de vider le cache du navigateur

3. **Erreur de validation**
   - Assurez-vous que toutes les catégories utilisées ont un nom
   - Vérifiez que les valeurs saisies sont dans la liste autorisée (0.25, 0.5, 0.75, 1)

## 🤝 Contribution

Pour contribuer au projet :

1. Fork le repository
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est développé en interne pour XNDATA.

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement XNDATA.

---

**Développé avec ❤️ par l'équipe XNDATA**
