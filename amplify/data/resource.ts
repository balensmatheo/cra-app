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
    allow.authenticated().to(['read']),
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

  // --- CRA (par mois) ---
  Cra: a.model({
    month: a.string().required(), // 'YYYY-MM'
    status: a.enum(['draft','saved','validated','closed']), // default géré applicativement
  isSubmitted: a.boolean().default(false),
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
  }).authorization(allow => [
    allow.authenticated().to(['read']),
    allow.owner(),
    allow.group('ADMINS')
  ]),

  // (Legacy model `CRA` supprimé après migration complète.)

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
