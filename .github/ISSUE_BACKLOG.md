# CRA App — Backlog Structuré (Amplify Gen2 + Next.js)

Ce document liste les issues actionnables pour GitHub Copilot Agent. Chaque issue contient : titre, objectif, portée, tâches détaillées (checklist), labels suggérés, dépendances, critères d'acceptation (CA) et DoD spécifiques (complétant le DoD global : build+lint OK, tests existants verts, pas d'erreurs console, règles d'accès respectées).

## Priorisation (vue d'ensemble)
P1 (fondations & valeur immédiate) : Issues 01,02,03,05,06,07,08,09,10,11,12,13  
P2 (améliorations UX / seeds / optimisation) : Issues 04,14,15, Bonus UX  
Ordre recommandé (critique → dépendances → reporting) : 01 → 02 → 03 → 05 → 07 → 08 → 06 → 09 → 10 → 11 → 12 → 13 → 04 → 14 → 15 → Bonus UX.

---

## ISSUE 01 — Gen2 Data : modèles CRA + règles d’accès
Labels: `type:data`, `priority:P1`, `area:auth`

Objectif: Définir schéma DataStore (Amplify Gen2) + autorisations.

Portée: Fichier `amplify/data/resource.ts` (ou équivalent). Création des modèles et règles.

Checklist:
- [x] Ajouter modèles UserProfile, Category, SpecialDay, Cra, CraEntry (cf. spécifications champs).
- [x] Relations: Cra hasMany CraEntry; CraEntry belongsTo Cra & Category.
- [x] Ajouter enums (kinds, statuses, types, scopes).
- [x] Ajouter auth:
  - [x] Cra / CraEntry: authenticated -> read; owner -> CRUD own; group ADMINS -> CRUD global.
  - [x] Category / SpecialDay / UserProfile: authenticated read; group ADMINS CRUD.
- [x] Exporter le type `Schema` & `data`.
- [x] Vérifier génération local (`amplify sandbox` ou build) sans erreur (OK via build sans erreurs TS).
Note: Documentation README à compléter ultérieurement (reste mineur).

Dépendances: Aucune.

CA:
- [ ] Un user (groupe USERS) peut lister tous les Cra/CraEntry.
- [ ] Un user ne peut créer/éditer/supprimer que ses Cra/CraEntry.
- [ ] Admin peut CRUD tout.
- [ ] Catégories & jours spéciaux visibles par tous, modifiables seulement par admin.

DoD additif: Documentation courte dans README sur champs + owner.

---

## ISSUE 02 — Redirection post-login vers CRA courant
Labels: `type:ux`, `priority:P1`, `area:ui`

Objectif: Après sign-in, rediriger vers `/cra/[YYYY-MM]?user=me`.

Checklist:
- [x] Identifier point d'entrée post-auth (callback route ou layout root).
- [x] Calculer mois courant (TZ locale) format `YYYY-MM`.
- [x] Si arrivée sur `/` après login (pas de deep link), redirect vers `/cra/<month>?user=me`.
- [x] Préserver navigation si deep-link initial (param `returnTo`).
- [x] Tests manuels (login, deep link, refresh) (effectués manuellement).
Status: DONE (2025-08-11)

Dépendances: Issue 01 (accès aux données CRA ensuite).

CA:
- [ ] Connexion standard mène direct au CRA courant.
- [ ] Deep link conserve destination.

---

## ISSUE 03 — Saisie CRA : Enregistrer vs Valider + validation + read-only
Labels: `type:feat`, `priority:P1`, `area:ui`

Objectif: Introduire statuts (draft/saved/validated) avec règles de validation et mode lecture seule non-owner/non-admin.

Checklist:
- [x] Ajouter boutons: Enregistrer, Soumettre (Valider), Réinitialiser (implémenté avant Issue 14, restera à harmoniser).
- [x] Afficher badge d'état (draft/saved/validated/closed).
- [ ] Lecture seule si (user != owner && !admin) ou status=closed (status closed/validated OK, condition non-owner encore à implémenter).
- [x] Implémenter logique de validation (pré-validation) :
  - [x] Somme des `value` par jour = 1 (bloquant Valider).
  - [x] Nombre de jours saisis == nb jours ouvrés.
  - [x] Catégorie requise pour toute entrée.
  - [x] Commentaire obligatoire si kind ∈ {facturee, non_facturee}.
- [x] Désactiver Valider tant que conditions non réunies (bouton Soumettre disabled + tooltip à venir).
- [x] Mutation status -> validated uniquement si règles OK.
- [x] Messages d'erreurs accessibles (modal listant les erreurs).
- [ ] Protection backend stricte (garde client ajoutée; renforcement côté backend à faire si nécessaire).
Progress: MAJOR DONE. Restant: différencier owner/admin, enforcement backend.

Dépendances: 01 (modèles), 08 (jours spéciaux pour calcul ouvrés), 07 (kinds cat/com rules).

CA:
- [ ] Impossible de valider si une règle échoue (feedback explicite).
- [ ] Non-owner non-admin ne peut pas éditer (UI + test échec backend).

---

## ISSUE 04 — Mobile : optimisation responsive & densification
Labels: `type:ux`, `priority:P2`, `area:ui`

Objectif: Améliorer ergonomie mobile (table dense + actions accessibles).

Checklist:
- [ ] Réduire padding/hauteur lignes table (classes utilitaires).
- [ ] Colonnes clés figées (jour/catégorie) via CSS sticky.
- [ ] Gérer overflow-x contrôlé (scroll container).
- [ ] Ajouter barre d'action compacte ou FAB (Enregistrer/Valider/Exporter).
- [ ] Vérifier Lighthouse mobile (Best Practices ≥ 90) et noter score.

Dépendances: 03 (actions), 13 (export bouton), Bonus UX (sticky summary) optionnel.

CA:
- [ ] Pas de scroll horizontal involontaire.
- [ ] Actions principales atteignables d'un pouce (viewport <= 400px width test).

---

## ISSUE 05 — Onglet “Congés” + auto-remplissage CRA
Labels: `type:feat`, `priority:P1`, `area:ui`

Objectif: CRUD congés et sync automatique des CraEntry (value=1, catégorie non_facturée:conge).

- Checklist:
- [x] Créer page `/conges` (sous `(authenticated)` – CRUD congés + auto CRA, doublon supprimé).
- [x] Définir approche: utilisation SpecialDay scope=user type=conge_obligatoire (implémenté).
- [x] Formulaire: plage de dates (début/fin) + filtrage jours ouvrés du mois.
- [x] Création → génération CraEntry auto (value=1) si catégorie "Congé" détectée (comment `[AUTO_CONGE]`).
- [x] Suppression → retrait entrées auto taggées `[AUTO_CONGE]` pour la date.
- [x] Bandeau informatif CRA (count déjà visible côté CRA pour type conge_obligatoire).
- [x] Idempotence: évite doublons (skip dates existantes & skip date avec entrée existante).
- [ ] Protection stricte auth (redirect si non connecté) à affiner.
- [ ] Sélection / création forcée catégorie Congé si absente (actuellement warning seulement).
Progress: ADVANCED (reste améliorations auth + robustesse catégorie).

## ISSUE 06 — Admin : gestion des utilisateurs
Labels: `type:admin`, `priority:P1`, `area:auth`

Objectif: Page `/admin/users` pour gestion profils / activation / groupes.

Checklist:
- [x] Page scaffold `/admin/users` (placeholder + contrôle accès ADMIN de base).
- [ ] Lambda (Function) avec permissions `cognito-idp:*` restreintes nécessaires (list/update groups, enable/disable user).
- [ ] API sécurisée (ADMINS only) exposant endpoints: list, updateStatus, updateGroups, updateProfile.
- [ ] UI actions: activer/désactiver, assigner groupes, éditer displayName.
- [ ] Traçabilité: stocker updatedBy, updatedAt dans UserProfile.
- [ ] Rafraîchissement liste après action.

Dépendances: 01 (UserProfile), infra IAM.

CA:
- [ ] Admin modifie groupe et désactivation reflétée (test réel).
- [ ] Journal (updatedAt / updatedBy) mis à jour.

## ISSUE 07 — Admin : gestion des catégories
Labels: `type:admin`, `priority:P1`, `area:data`

Objectif: CRUD Category + contrainte commentaire requis.

Checklist:
- [x] Page `/admin/categories` (table + form create/update + toggle active).
- [ ] Empêcher suppression si utilisée (optionnel: soft disable; actuellement pas de suppression UI exposée, toggle active suffit pour MVP).
- [ ] Propager règle commentaire requis selon kind (facturee/non_facturee => requis) dynamiquement (actuel: logique locale via categoriesMap; besoin: recharger après changement kind en cours de saisie pour nouvelles entrées).
Progress: CORE DONE (CRUD + activation). Reste: dynamique commentaire + éventuelle suppression contrôlée.

Dépendances: 01.

CA:
- [ ] Règle commentaire dynamique testée (changer kind d'une catégorie existante reflète UI sur nouvelle entrée).

---

## ISSUE 08 — Admin : calendrier des jours spéciaux
Labels: `type:admin`, `priority:P1`, `area:data`

Objectif: CRUD SpecialDay (global/user) impactant calcul jours ouvrés.

Checklist:
- [x] Page `/admin/special-days` (CRUD basique liste + ajout + suppression) – amélioration calendrier à venir.
- [ ] Calendrier interactif (global vs user scope).
- [ ] Édition (modification type/scope) inline.
- [ ] Recalcul immédiat du nombre de jours ouvrés pour mois affectés (hook ou recalcul côté page CRA).
- [x] Types gérés: ferie, seminaire, conge_obligatoire, autre.
- [x] Si scope=user => userId requis.

Progress: PARTIAL (calendrier & édition manquants).

CA:
- [ ] Ajouter un jour férié réduit le quota ouvrés immédiatement visible.

---

## ISSUE 09 — Admin : clôture mensuelle
Labels: `type:admin`, `priority:P1`, `area:data`

Objectif: Verrouiller édition après clôture (status=closed).

Checklist:
- [ ] Ajouter transition status validated -> closed (admin only).
- [ ] UI admin toggle sur CRA (par mois + utilisateur) ou bulk closure.
- [ ] Backend refuse toute mutation Cra/CraEntry si closed (sauf admin si override futur non prévu ici).
- [ ] Afficher badge "Clôturé" + désactiver inputs.

Dépendances: 03, 01.

CA:
- [ ] Impossible de modifier un CRA closed (test user + admin).

---

## ISSUE 10 — Admin : modifier le CRA d’un collaborateur
Labels: `type:admin`, `priority:P1`, `area:ui`

Objectif: Mode override admin (édition autres utilisateurs tant que non closed).

Checklist:
- [ ] UI permettant sélection collaborateur ou CRA d'un autre (switch user context).
- [ ] Indicateur visuel "Mode Admin".
- [ ] Respect des règles: closed reste non éditable.
- [ ] Journalisation (optionnel) des entrées modifiées par admin (champ lastModifiedBy?).

Dépendances: 09, 01, 03.

CA:
- [ ] Admin édite CRA d'autrui (non closed) avec succès.

---

## ISSUE 11 — Reporting Dashboards + Export Excel
Labels: `type:reporting`, `priority:P1`, `area:api`

Objectif: Deux agrégations (Dash1 activité→commentaire→collaborateur, Dash2 activité→collaborateur→commentaire) + export xlsx.

Checklist:
- [ ] Créer routes `api/reporting/dash1` & `dash2` (GET month param).
- [ ] Requêtes list CRA (month), entries, categories, users.
- [ ] Agrégation Dash1 (activité -> commentaire -> collaborateur).
- [ ] Agrégation Dash2 (activité -> collaborateur -> commentaire).
- [ ] Génération Excel (exceljs) colonnes, autoFilter, formatting (nombre de jours). 
- [ ] Gérer pagination (loop nextToken) si nécessaire (TODO si dataset large).
- [ ] Tests manuels export (ouvrir fichier, contenu).

Dépendances: 01.

CA:
- [ ] Téléchargement fonctionnel pour mois choisi (2 endpoints).

---

## ISSUE 12 — Reporting : état des saisies fin de mois
Labels: `type:reporting`, `priority:P1`, `area:api`

Objectif: Synthèse par utilisateur (non saisi / draft|saved / validated / closed) + jours saisis vs ouvrés + export.

Checklist:
- [ ] Route `api/reporting/status?month=`.
- [ ] Calcul jours ouvrés (WE + SpecialDay férié/conge_obligatoire exclus).
- [ ] Pour chaque user: trouver CRA (month), status, somme values, ratio.
- [ ] Statut non saisi si aucun CRA.
- [ ] Export CSV + XLSX.
- [ ] Page `/admin/reporting` affichant tableau + filtres.

Dépendances: 08 (jours spéciaux), 01, 03, 09.

CA:
- [ ] Tableau exact pour échantillon test (scénarios: absent, draft, validated, closed).

---

## ISSUE 13 — Export Excel vue utilisateur
Labels: `type:feat`, `priority:P1`, `area:ui`

Objectif: Bouton export CRA individuel.

Checklist:
- [ ] Ajouter bouton Export sur page CRA.
- [ ] Endpoint (réutiliser logique dashboard ou créer `api/cra/export` filtré user/craId).
- [ ] Format workbook: récap en entête (user, mois, statut, jours ouvrés, jours saisis) + détail lignes.
- [ ] Téléchargement côté navigateur (Blob).

Dépendances: 11 (excel util partagée), 03.

CA:
- [ ] Fichier téléchargé correct pour owner ou admin (autre user).

---

## ISSUE 14 — Nettoyage UX : bouton “Recharger”
Labels: `type:ux`, `priority:P2`, `area:ui`

Objectif: Clarifier action de reload.

Checklist:
- [ ] Auditer utilité bouton actuel.
- [ ] Si redondant => retirer.
- [ ] Sinon renommer "Réinitialiser les modifications non sauvegardées" + modal confirmation (lister conséquences).
- [ ] Test: modifications locales annulées après confirmation.

Dépendances: 03.

CA:
- [ ] Aucune confusion d'utilisateurs (retours QA) / fonction claire.

---

## ISSUE 15 — Seeds + Tests d’accès
Labels: `type:data`, `priority:P2`, `area:auth`

Objectif: Seeds catégories + jours spéciaux; tests d'accès basiques.

Checklist:
- [ ] Script seed (ex: `scripts/seed.ts`): 3 catégories (facturee, non_facturee, autre), plusieurs SpecialDay fériés.
- [ ] Documentation exécution seed.
- [ ] Tests manuels ou petit script: user USERS ne peut éditer CRA d'autrui.
- [ ] Test admin peut éditer n'importe lequel.
- [ ] Test closed non éditable.

Dépendances: 01, 09.

CA:
- [ ] Seeds réexécutables idempotents.

---

## BONUS UX — Récap sticky + tables serrées
Labels: `type:ux`, `priority:P2`, `area:ui`

Objectif: Récap du mois toujours visible + densité table.

Checklist:
- [ ] Section sticky top avec résumé (mois, total jours, ouvrés, statut, progression validation).
- [ ] Ajuster classes tables (text-sm, padding réduit).
- [ ] Vérifier compatibilité mobile (Issue 04).

Dépendances: 03, 04 (interaction densité), 08 (jours ouvrés).

CA:
- [ ] Récap visible en permanence pendant scroll.

---

## Script de création automatique (Optionnel)
Voir `scripts/create_github_issues.ps1` & `backlog/issues.json`.

---

## Champs & règles résumés
- owner (auto) pour Cra & CraEntry: filtrer "mes CRA".
- CRA.status: draft|saved|validated|closed (progression: draft→saved (optionnel)→validated→closed).
- Validation: somme journalière == 1, jours saisis = ouvrés, commentaire requis selon category.kind.
- Jours ouvrés: total jours du mois - (WE + SpecialDay type ferie/conge_obligatoire).

---

## Risques & Points de vigilance
- Pagination Amplify sur grosses listes (reporting) → prévoir loop nextToken future amélioration.
- Conflits édition admin vs user en temps réel (optimistic update vs refresh après validation/closure).
- Calcul jours ouvrés doit être centralisé (utilitaire partagé pour 03, 08, 12).
- Performance Excel: acceptable pour volume initial; streaming si >10k lignes (non prioritaire).

---

## Prochaines étapes recommandées
1. Implémenter ISSUE 01 puis lancer un sandbox/test auth.
2. Intégrer redirection (ISSUE 02) pour flux utilisateur fluide.
3. Construire logique de validation (ISSUE 03) avant d'automatiser congés & reporting.
4. En parallèle, préparer utilitaires communs (jours ouvrés, format date).

---

Document maintenable: Mettre à jour ce fichier à chaque issue créée/fermée si besoin de traçabilité hors GitHub.
