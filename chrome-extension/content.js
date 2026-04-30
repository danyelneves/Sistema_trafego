chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_ad") {
    // This is a naive extraction for demonstration. Facebook DOM classes change often.
    // It assumes the user has their mouse over or is looking at the first visible ad block.
    
    // Attempt to find the advertiser name
    const advertiserEl = document.querySelector('a.xt0psk2'); // Classes are obfuscated and change
    const advertiser = advertiserEl ? advertiserEl.innerText : 'Competidor Desconhecido';

    // Attempt to find the ad copy text
    const textEls = document.querySelectorAll('div[dir="auto"]');
    let copyText = "";
    for(let el of textEls) {
      if(el.innerText && el.innerText.length > 50) {
        copyText = el.innerText;
        break;
      }
    }

    // Attempt to find media URL (video/img)
    const imgEl = document.querySelector('img.x1ll5gia');
    const videoEl = document.querySelector('video');
    
    let mediaUrl = "";
    if (videoEl && videoEl.src) mediaUrl = videoEl.src;
    else if (imgEl && imgEl.src) mediaUrl = imgEl.src;

    sendResponse({
      success: true,
      ad: {
        advertiser: advertiser,
        copyText: copyText,
        mediaUrl: mediaUrl,
        adUrl: window.location.href
      }
    });
  }
  return true;
});
