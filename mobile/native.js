import {App} from '@capacitor/app';
import {Preferences} from '@capacitor/preferences';
import {LocalNotifications} from '@capacitor/local-notifications';

document.documentElement.classList.add('handheld');
const key='wall-bounce-profile', reminderId=401;
let storageReady=false;
function validProfile(value){
 if(value===null)return null;
 try{const data=JSON.parse(value);return data&&typeof data==='object'&&!Array.isArray(data)?data:null;}catch{return null;}
}
window.wallBounceStorage={
  async load(){
    const {value}=await Preferences.get({key});
    const primary=validProfile(value);
    if(primary){storageReady=true;return primary;}
    const backup=(await Preferences.get({key:key+'-backup'})).value;
    if(value!==null)await Preferences.set({key:key+'-recovery',value});
    storageReady=true;
    return validProfile(backup);
  },
  async save(profile){
    if(!storageReady)throw new Error('El almacenamiento aún no está disponible.');
    const previous=(await Preferences.get({key})).value;
    if(validProfile(previous))await Preferences.set({key:key+'-backup',value:previous});
    await Preferences.set({key,value:JSON.stringify(profile)});
  }
};
async function planReminder(){
  const when=new Date();
  when.setDate(when.getDate()+4);
  when.setHours(17,0,0,0);
  await LocalNotifications.cancel({notifications:[{id:reminderId}]});
  try{
    await LocalNotifications.createChannel({id:'station',name:'Noticias de la estación',importance:2,vibration:false});
  }catch(error){
    // Android 7 delivers silent notifications without notification channels.
    if(error.code!=='UNAVAILABLE')throw error;
  }
  await LocalNotifications.schedule({notifications:[{id:reminderId,silent:true,isExactNotification:false,channelId:'station',title:'Wall Bounce',body:'La estación está abierta cuando quieras volver.',schedule:{at:when}}]});
}
let notificationQueue=Promise.resolve();
function enqueue(task){
  const next=notificationQueue.then(task);
  notificationQueue=next.catch(()=>{});
  return next;
}
window.mobileStation={
  change(enabled){return enqueue(async()=>{
    if(enabled){
      const p=await LocalNotifications.requestPermissions();
      if(p.display!=='granted')return false;
      await planReminder();
    }else await LocalNotifications.cancel({notifications:[{id:reminderId}]});
    return enabled;
  });},
  refresh(){return enqueue(async()=>{
    if((await LocalNotifications.checkPermissions()).display!=='granted')return false;
    await planReminder();return true;
  });},
  exit:()=>App.exitApp()
};
App.addListener('backButton',()=>window.dispatchEvent(new Event('station-back')));
App.addListener('appStateChange',({isActive})=>window.dispatchEvent(new Event(isActive?'station-active':'station-sleep')));
