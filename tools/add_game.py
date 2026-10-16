#!/usr/bin/env python3
"""Register a game (goes to the top of the gallery): python3 tools/add_game.py <folder> "Title" "Tagline"
The folder must already contain index.html (and optionally thumb.png)."""
import json,sys,os,datetime
folder,title,tag=sys.argv[1].strip('/'),sys.argv[2],(sys.argv[3] if len(sys.argv)>3 else '')
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assert os.path.exists(os.path.join(root,folder,'index.html')),'no index.html in '+folder
p=os.path.join(root,'games.json');games=json.load(open(p))
games=[g for g in games if g['id']!=folder]
e={'id':folder,'title':title,'tagline':tag,'path':folder+'/','added':datetime.date.today().isoformat()}
if os.path.exists(os.path.join(root,folder,'thumb.png')):e['thumb']=folder+'/thumb.png'
games.insert(0,e);json.dump(games,open(p,'w'),indent=2);print('added',title)
