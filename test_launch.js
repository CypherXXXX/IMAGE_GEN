const { exec } = require('child_process');
exec('start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="D:\\Prog\\IMAGE_GEN\\browser-profiles\\chatgpt-main" https://chatgpt.com', (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});
