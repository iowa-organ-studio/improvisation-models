1. Navigate to the generator folder
From your repository's main folder (improvisation-models), run:
cd .\tunes\Venetian-Toccata\lilypond\_template


2. Generate one phrase in all 15 keys
For example:
.\generate.ps1 Merulo-Book2Tocc1Tone5-01


This generates stage 1 and stage 5 SVGs in all 15 keys for that phrase.

Step 1: Return to the repository root
If you're still in the LilyPond _template folder, run:
cd ..\..\..\..


You should now be in your improvisation-models folder.
Step 2: Check your changes
git status --short


This shows your new files and any modified files.
Step 3: Stage the Venetian Toccata changes
git add -A -- tunes/Venetian-Toccata


This includes your new phrase, .krn files, generated SVGs, and any updated phrases.json.

If you also changed app.js, run:
git add js/app.js


Step 4: Commit
git commit -m "Add new Venetian Toccata phrase"


Step 5: Push to GitHub
git push origin main


That's it! Your new phrase will be uploaded to your existing GitHub repository.