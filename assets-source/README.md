# Sources graphiques

Fichiers **hors du chemin servi**. Rien ici n'est exposé publiquement : `public/`
est servi tel quel par Next, ce dossier ne l'est pas.

| Fichier | Rôle |
|---|---|
| `logo_cedre-2048.png` | Original 2048×2048 du logo. Source de vérité pour régénérer `public/logo_cedre.png`. |
| `logo_cedre_anim.mp4` | Logo animé. **Non utilisé** par l'application — conservé ici au cas où, plutôt que dans `public/` où il était téléchargeable sans jamais servir. |

## Régénérer le logo

`public/logo_cedre.png` pesait **1 744 144 octets** alors qu'il n'est rendu qu'en
50×50 dans la navbar (`components/layout/Navbar.tsx`) — et surtout qu'il est servi
**brut, sans passer par `next/image`**, comme icône et badge de notification push
(`app/api/firebase-messaging-sw/route.ts`, `supabase/functions/_shared/fcm.ts`,
`notify-new-listing`, `notify-new-message`). Chaque notification tirait donc 1,7 Mo.

192×192 couvre le rendu navbar jusqu'en 3× et correspond à la taille d'icône
attendue par FCM :

```bash
node -e "require('sharp')('assets-source/logo_cedre-2048.png').resize(192,192,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9,effort:10}).toFile('public/logo_cedre.png')"
```

`sharp` est déjà disponible (dépendance de Next). Résultat attendu : ~17 Ko.

Pas de `palette: true` : la quantification 256 couleurs ne gagnait que 4,5 Ko, et
le fichier est servi sans ré-encodage sur le chemin des notifications — autant
garder les couleurs vraies.
