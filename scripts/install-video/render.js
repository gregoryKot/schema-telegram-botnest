const {chromium}=require('playwright');const fs=require('fs');const {execFileSync}=require('child_process');
const FPS=30,only=process.argv[2],stills=process.argv[3]==='stills';
(async()=>{const br=await chromium.launch();
for(const b of ['ios-safari','ios-chrome','android-chrome','android-yandex']){ if(only&&only!=='all'&&only!==b)continue;
 const p=await br.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
 p.on('pageerror',e=>console.log('ERR',b,e.message));
 await p.goto('file://'+__dirname+'/guide.html?rec=1&b='+b);await p.waitForFunction('window.ready',null,{timeout:10000});
 const total=await p.evaluate('TOTAL');const tm=await p.evaluate('TIMES');const dir=__dirname+'/f-'+b;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);
 if(stills){for(const [k,t] of [...tm.taps.map(t=>t-300),tm.done+1500].entries()){await p.evaluate(t=>seek(t),t);await p.screenshot({path:`${__dirname}/still-${b}-${k}.png`});}await p.close();continue;}
 const n=Math.round(total/1000*FPS);
 for(let i=0;i<n;i++){await p.evaluate(t=>seek(t),i*1000/FPS);await p.screenshot({path:`${dir}/${String(i).padStart(4,'0')}.png`});}
 await p.close();
 execFileSync('python3',[__dirname+'/music.py',dir+'/m.wav',tm.total,tm.done,...tm.taps].map(String));
 execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',FPS,'-i',dir+'/%04d.png','-i',dir+'/m.wav','-c:a','aac','-b:a','96k','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-crf','24','-preset','slow','-movflags','+faststart',`${__dirname}/install-${b}.mp4`]);
 fs.rmSync(dir,{recursive:true,force:true});console.log('ok',b);
}
await br.close();})();
