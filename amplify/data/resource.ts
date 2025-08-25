import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { listUsersFn } from './list_user/resource.js';
import { createUserFn } from './create_user/resource.js';
import { getUserFn } from './get_user/resource.js';
import { deleteUserFn } from './delete_user/resource.js';

/**
 * ISSUE 01 — Nouveau schéma CRA (Amplify Gen2)
 * --------------------------------------------------
 * Modèles ajoutés (nouvelle architecture) :
 *  - UserProfile
 *  - Category
 *  - SpecialDay
 *  - Cra
 *  - CraEntry
 *
 * Règles d'accès attendues :
 *  - Tous les utilisateurs authentifiés peuvent lire les CRA / entrées / catégories / jours spéciaux / profils.
 *  - Un utilisateur peut créer/mettre à jour/supprimer UNIQUEMENT ses propres Cra & CraEntry (allow.owner()).
 *  - Le groupe ADMINS a plein accès (CRUD) global.
 *
 * NOTE: Migration vers Cra/CraEntry finalisée; le modèle legacy `CRA` a été
 * retiré du schéma. Le front utilise désormais exclusivement Cra/CraEntry.
 */

const schema = a.schema({
  // --- Nouveau modèle profil utilisateur ---
  UserProfile: a.model({
    displayName: a.string().required(),
    email: a.email().required(),
    groups: a.string().array().required(),
  active: a.boolean().default(true),
  updatedBy: a.string(), // traçabilité admin modifications groupes/activation
  }).authorization(allow => [
    allow.authenticated().to(['read']),
    allow.group('ADMINS').to(['create','read','update','delete'])
  ]),

  // --- Catégories d'activité ---
  Category: a.model({
    label: a.string().required(),
    // enum: Amplify Gen2 ne supporte pas .required() / .default() sur enum directement
    kind: a.enum(['facturee','non_facturee','autre']),
    active: a.boolean().default(true), // boolean accepte default
  entries: a.hasMany('CraEntry','categoryId'), // back-reference pour belongsTo category
  }).authorization(allow => [
    // Autoriser tous les utilisateurs authentifiés à LIRE et CRÉER des catégories
    // (utile pour gérer plusieurs lignes avec le même libellé côté utilisateur)
    allow.authenticated().to(['read','create']),
    // Les admins gardent les droits complets
    allow.group('ADMINS').to(['create','read','update','delete'])
  ]),

  // --- Jours spéciaux (férié, séminaire, etc.) ---
  SpecialDay: a.model({
    date: a.string().required(), // format 'YYYY-MM-DD'
    type: a.enum(['ferie','seminaire','conge_obligatoire','autre']),
    scope: a.enum(['global','user']),
    userId: a.string(), // requis seulement si scope = 'user'
  }).authorization(allow => [
    allow.authenticated().to(['read']),
    allow.group('ADMINS').to(['create','read','update','delete'])
  ]),

  // --- Verrouillage mensuel global (bloque la saisie pour un mois) ---
  MonthLock: a.model({
    month: a.string().required(), // 'YYYY-MM'
    locked: a.boolean().default(true),
  }).authorization(allow => [
    allow.authenticated().to(['read']), // tout le monde peut lire l'état du mois
    allow.group('ADMINS').to(['create','read','update','delete']) // seuls les admins modifient
  ]),

  // --- CRA (par mois) ---
  Cra: a.model({
    month: a.string().required(), // 'YYYY-MM'
    status: a.enum(['draft','saved','validated','closed']), // default géré applicativement
  isSubmitted: a.boolean().default(false),
  // Propriétaire du CRA (sub Cognito)
  owner: a.string().required(),
    entries: a.hasMany('CraEntry', 'craId'),
  }).authorization(allow => [
    allow.authenticated().to(['read']), // lecture globale
    allow.owner(),                      // CRUD sur son propre CRA
    allow.group('ADMINS')               // CRUD global
  ]),

  // --- Entrées journalières du CRA ---
  CraEntry: a.model({
  // Relations: clés étrangères explicites + belongsTo
  craId: a.id().required(),
  cra: a.belongsTo('Cra', 'craId'),
    date: a.string().required(), // 'YYYY-MM-DD'
  categoryId: a.id().required(),
  // clé étrangère categoryId rendue required pour cohérence relationnelle
  // (si optionnel, Amplify peut ne pas générer la relation attendue)
  // Ajustement: remplacer ligne précédente par required()
  category: a.belongsTo('Category','categoryId'),
    value: a.float().required(), // contrainte 0..1 à appliquer en UI / validations back
    comment: a.string(),
  // Source metadata for automated syncs (leave, seminar, etc.)
  // Allows selective revocation and auditing of injected entries
  sourceType: a.string(), // e.g., 'leave' | 'seminar' | 'special' | 'manual'
  sourceId: a.string(),   // id of the originating entity (e.g., LeaveRequest.id)
  sourceNote: a.string(), // snapshot of the original note/comment at the time of injection
  // Propriétaire de l'entrée (sub Cognito du CRA cible). Optionnel côté modèle, utile pour audit.
  owner: a.string(),
  }).authorization(allow => [
    allow.authenticated().to(['read']),
    allow.owner(),
    allow.group('ADMINS')
  ]),

  // (Legacy model `CRA` supprimé après migration complète.)

  // --- Demandes de congés ---
  LeaveRequest: a.model({
    startDate: a.string().required(), // 'YYYY-MM-DD'
    endDate: a.string().required(),   // 'YYYY-MM-DD'
  status: a.enum(['pending','approuvee','refusee']),
  // Type d'absence: congé, congé maladie, temps universitaire
  absenceType: a.enum(['conge','maladie','universitaire']),
    reason: a.string(),
  adminNote: a.string(), // message de l'admin communiqué à l'utilisateur
  userRead: a.boolean().default(false),   // notification lue par l'utilisateur
  userHidden: a.boolean().default(false), // masquée de l'inbox utilisateur
  // Pièce jointe (stockée via Amplify Storage)
  attachmentKey: a.string(),
  // IdentityId du propriétaire du fichier (requis pour lire un objet protected d'un autre utilisateur)
  attachmentIdentityId: a.string(),
  }).authorization(allow => [
    // Tous les utilisateurs peuvent lire les congés (pour le calendrier)
    allow.authenticated().to(['read']),
    // Chaque utilisateur gère ses propres demandes
    allow.owner().to(['create','update','delete']),
    // Les admins ont tous les droits
    allow.group('ADMINS').to(['create','read','update','delete'])
  ]),

  // --- Invitations de séminaire ---
  SeminarInvite: a.model({
    startDate: a.string().required(), // 'YYYY-MM-DD'
    endDate: a.string().required(),   // 'YYYY-MM-DD'
    title: a.string(),                // ex: 'Séminaire'
    message: a.string(),              // message optionnel
    location: a.string(),             // Lieu du séminaire
    activities: a.string(),           // Description des activités
    details: a.string(),              // Détails supplémentaires
    refuseReason: a.string(),         // Justification si refusé
    imageUrl: a.string(),             // URL de l'image de couverture
    status: a.enum(['pending','accepted','refused']),
    userRead: a.boolean().default(false),
    userHidden: a.boolean().default(false),
    owner: a.string(),                // Propriétaire de l'invitation (sub de l'utilisateur cible)
  }).authorization(allow => [
  // L'utilisateur (propriétaire) peut lire/mettre à jour ses propres invitations, les admins ont tous les droits.
  allow.owner().to(['read','update']),
  allow.group('USERS').to(['read']), // permettre aux utilisateurs de lister les invités (lecture seule)
  allow.group('ADMINS').to(['create','read','update','delete'])
  ]),

  // --- Admin custom operations (per Amplify docs) ---
  listUsers: a
    .query()
    .arguments({
      search: a.string(),
    })
  .authorization((allow) => [allow.group('ADMINS'), allow.group('USERS')])
    .handler(a.handler.function(listUsersFn))
    .returns(a.json()),

  createUser: a
    .mutation()
    .arguments({
      email: a.string().required(),
      groups: a.string().array(),
    })
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(createUserFn))
    .returns(a.json()),

  getUser: a
    .query()
    .arguments({
      sub: a.string().required(),
    })
  .authorization((allow) => [allow.group('ADMINS'), allow.group('USERS')])
    .handler(a.handler.function(getUserFn))
    .returns(a.json()),

  deleteUser: a
    .mutation()
    .arguments({
      sub: a.string().required(),
    })
    .authorization((allow) => [allow.group('ADMINS')])
    .handler(a.handler.function(deleteUserFn))
    .returns(a.json()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

// Prochaines étapes :
//  - Mettre à jour le front pour utiliser Cra / CraEntry (Issue 03)
//  - Mettre en place calcul et validations (Issue 03)
//  - Retirer le modèle legacy `CRA` une fois la migration effectuée.
