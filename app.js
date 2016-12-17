var express = require('express')
var mp = require('wechat-mp')('testtoken')
var wechatAPI = require('wechat-api')
var api = new wechatAPI('wx279002cb9deb576f', 'be97aa26e1c1619a0b73a792cf59047d')
var app = express()

app.use(mp.start())
app.post('/', (req, res, next) => {
    switch (req.body.type) {
      case 'event':
        eventHander(req, res, next)
        break;
      default:

    }
    console.log(req.body)
    res.body = {
        msgType: 'text',
        content: 'test reply'
    }
    next()
}, mp.end())

app.listen(80)

eventHander()
// var appID = 'wx279002cb9deb576f'
// var appsecret = 'be97aa26e1c1619a0b73a792cf59047d'
// var accessToken = ''
//
// var apiUrl = 'https://api.weixin.qq.com/'
// // verify the request from
// app.use((req, res, next) => {
//
//     // 加密/校验流程如下：
//     // 1. 将token、timestamp、nonce三个参数进行字典序排序
//     // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
//     // 3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
//     var signature = req.query.signature
//     var timestamp = req.query.timestamp
//     var nonce = req.query.nonce
//     var token = 'testtoken'
//     var signArr = [
//         nonce,
//         timestamp,
//         token
//     ].sort()
//     var sha1 = crypto.createHash('sha1')
//     var oriStr = signArr.join('')
//     sha1.update(oriStr)
//     var hashedStr = sha1.digest('hex')
//     // request type switch
//     if (hashedStr != signature) {
//         res.status(300).send('request error')
//         return
//     } else if ('echostr' in req.query) {
//         res.status(200).send(req.query.echostr)
//         return
//     } else {
//         next()
//     }
// })
// var xmlparser = require('express-xml-bodyparser');
// app.all('/', xmlparser({trim: false, explicitArray: false}), (req, res) => {
//
//     if ('MsgType' in req.query) {
//         eventHander(req, res)
//     } else {
//         var xml = req.body.xml
//         textReciver(xml, req, res)
//     }
// })
//
// app.listen(80)
//
// var freshAccessToken = () => {
//     request({
//         url: apiUrl + 'cgi-bin/token',
//         method: 'GET',
//         qs: {
//             grant_type: 'client_credential',
//             appid: appID,
//             secret: appsecret
//         }
//     }, (err, res, body) => {
//         if (err) {
//             console.log(err)
//         } else {
//             var json = JSON.parse(body)
//             if ('errcode' in json) {
//                 console.log(json.errmsg)
//             } else {
//                 accessToken = json.access_token
//                 console.log('access token got!')
//             }
//         }
//     })
// }
// freshAccessToken()
//
// var eventHander = (req, res) => {
//     var event = req.query.Event
//     switch (event) {
//       case 'subscribe':
//         subscribeHander(req, res)
//         break;
//       case 'text':
//         textReciver(req, res)
//         break;
//       default:
//
//     }
// }
//
// var textReciver = (xml, req, res) => {
//   console.log(xml)
//     var toUserName = xml.tousername
//     var fromUserName = xml.fromusername
//     var createTime = xml.createtime
//     var content = xml.content
//     var re = replyText(fromUserName, toUserName, createTime, content)
//     res.status(200).type('text/xml').send(re).end()
//     console.log(re)
// }
//
// // var subscribeHander = (req, res) => {
// //     var toUserName = req.query.ToUserName
// //     var fromUserName = req.query.FromUserName
// //     var createTime = req.query.CreateTime
// //     var content = '\
// //         欢迎来到村庄游戏，这是微信上的第一款策略游戏。你可以生产粮食 🍞，将他们换成金子，进行任务，攻击其他玩家，并且发展你的村庄！\
// //         开始游戏吧！\
// //     '
// //     res.writeHead(200, {'Content-Type': 'application/xml'}).send(replyText(toUserName, fromUserName, createTime, content))
// // }
//
// var replyText = (toUserName, fromUserName, createTime, content) => {
//     var xml = '<xml>\n<ToUserName><![CDATA[' + toUserName + ']></ToUserName>\n<FromUserName><![CDATA[' + fromUserName + ']]></FromUserName>\n<CreateTime>' + createTime + '</CreateTime>\n<MsgType><![CDATA[text]]></MsgType>\n<Content><![CDATA[' + content + ']]></Content>\n</xml>';
//     return xml
// }
