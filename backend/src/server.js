const express = require("express");

const app = express();

app.listen(3000, () => {
    console.log("서버 주소: http://localhost:3000");
})

app.get("/", (req, res) => {
    console.log("백엔드 실행");
})