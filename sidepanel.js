const $=id=>document.getElementById(id); const trace=[]; let recognition=null;
function log(type,msg){trace.push(`[${new Date().toLocaleTimeString()}] ${type}: ${msg}`);$("trace").textContent=trace.slice(-40).join("\n");}
async function activeChat(){const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});const tab=tabs[0];if(!tab||!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab.url||""))throw new Error("Active tab is not ChatGPT. Use Open ChatGPT or switch to a ChatGPT tab.");return tab;}
async function sendText(text){
      const tab=await activeChat();
      let r;
      try{
        r=await chrome.tabs.sendMessage(tab.id,{type:"SEND_PROMPT",text});
      }catch(e){
        throw new Error("ChatGPT bridge is not ready. Reload the ChatGPT tab and try again.");
      }
      if(!r?.ok)throw new Error(r?.error||"Could not send.");
      log("EXECUTE","Submitted prompt through the visible ChatGPT UI.");
    }
$("send").onclick=async()=>{const text=$("prompt").value.trim();if(!text)return;try{await sendText(text);$("prompt").value="";$("response").textContent="Waiting for visible response…";}catch(e){log("ERROR",e.message)}};
$("continue").onclick=async()=>{try{const tab=await activeChat();const r=await chrome.tabs.sendMessage(tab.id,{type:"CAPTURE_RESPONSE"});if(r?.text){$("response").textContent=r.text;log("OBSERVE","Captured current visible response.");}else log("OBSERVE","No visible response found.");}catch(e){log("ROUTE",e.message)}};
$("newchat").onclick=async()=>{
      try{
        const r=await chrome.runtime.sendMessage({type:"OPEN_CHATGPT"});
        if(!r?.ok)throw new Error(r?.error||"Could not open ChatGPT.");
        log("ROUTE","Located or opened the ChatGPT target.");
      }catch(e){
        log("ERROR",e.message);
      }
    };
$("mic").onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){log("VOICE","Speech recognition unavailable.");return}recognition=new SR();recognition.continuous=true;recognition.interimResults=true;recognition.lang=navigator.language||"en-US";$("mic").disabled=true;$("stop").disabled=false;recognition.onresult=e=>{let s="";for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;$("prompt").value=s};recognition.onerror=e=>log("VOICE","Error: "+e.error);recognition.onend=()=>{$("mic").disabled=false;$("stop").disabled=true};recognition.start();log("VOICE","Listening.")};
$("stop").onclick=()=>recognition?.stop();
