# WebSocket (index)

Cette documentation est découpée par domaine pour une meilleure lisibilité et maintenance.

- [Player](./socket/player.md)
- [Friend](./socket/friend.md)
- [Gift](./socket/gift.md)
- [GTS](./socket/gts.md)

## Format général des messages

Requête client:
```json
{
  "event": "nomEvenement",
  "data": { /* données spécifiques */ }
}
```

Réponse serveur:
```json
{
  "success": true,
  "message": "...",
  /* autres champs spécifiques */
}
```

## Gestion des erreurs
- `success: false`
- `message: string` décrivant l'erreur

Erreurs communes:
- "Player not found"
- "Invalid ... data"
- "Failed to ..."

## Notes d'authentification
Requièrent un joueur authentifié (via la connexion WebSocket):
- `friend*`
- `gift*`
- `gts*`
- `playerUpdate`, `playerDelete`

Le lien joueur–socket est établi après `playerCreate`.
