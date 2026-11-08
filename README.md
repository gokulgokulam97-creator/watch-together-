# Watch Together

Premium black interface for watching downloaded movies together (iOS + Android).

Both people need the **same movie file** on their phones. Playback stays synced in real time.

## Deploy in 2 minutes (permanent link)

1. Go to [github.com](https://github.com) and create a free account (if you don’t have one).
2. Create a new repository (name it anything, e.g. `watch-together`). Make it **Public**.
3. Upload all the files from this folder (drag & drop).
4. Go to [render.com](https://render.com) and create a free account (sign in with GitHub).
5. Click **New → Web Service**.
6. Connect the GitHub repository you just created.
7. Settings:
   - **Name**: watch-together (or anything)
   - **Region**: closest to you
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
8. Click **Create Web Service**.

After 1–2 minutes Render gives you a permanent link like:
`https://watch-together-xxxx.onrender.com`

Send that link to your partner. Both open it on your phones and you’re done.

## Using the app

1. Open the link on your phones (Safari on iPhone, Chrome on Android).
2. One person generates a room code and shares it.
3. Both join the same room.
4. Both tap **Choose Movie** and select the same downloaded movie file.
5. Press play — everything stays in sync + chat works.

## Notes

- Free Render sleeps after 15 minutes of no use. First load can take ~30 seconds to wake up.
- Both must have the exact same movie file downloaded on their phones.
- Keep the browser tab open while watching.
