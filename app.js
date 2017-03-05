const express = require('express')
const mp = require('wechat-mp')('testtoken')
const wechatAPI = require('wechat-api')
const api = new wechatAPI('wx279002cb9deb576f', 'be97aa26e1c1619a0b73a792cf59047d')
const mongoose = require('mongoose')
const User = require('./models/user.js')
const db = mongoose.connect('mongodb://127.0.0.1:27017/vg')
const rds = require('redis').createClient(6379, '127.0.0.1', {})
const async = require('async')
const app = express()
const schedule = require('node-schedule')
const product = require('./product.js')

schedule.scheduleJob('0 * * * * *', () => {
    console.log(`start product cron work (${Date.now()})`)
    rds.get('vg-usersum', (err, usersum) => {
        async.timesLimit(+usersum, 1, (n, next) => {
            product(n, next)
        }, (err, n) => {

        })
    })
})

const getLevel = exp => exp / 10000 << 0
const getExpPer = exp => (exp % 10000) / 100
const getWorkProduct = (workersum, framlevel) => {
    return workersum * 50 + framlevel * 15
}
const getLimit = (granarylevel) => {
    return 3000 + granarylevel * 100
}
let eventHander = {}
eventHander.handle = (req, res, next) => {
    let event = req.body.param.event
    if (event in eventHander) {
        eventHander[event](req, res, next)
    }
}

eventHander.subscribe = (req, res, next) => {
    res.body = {
        msgType: 'text',
        content: '欢迎来到村庄游戏，这是微信上的第一款策略游戏。你可以生产粮食🍞，将他们出售💰，进行任务，攻击其他玩家，并且发展你的村庄！\n开始游戏吧！\n发送"开始游戏"可以开始游戏\n发送"帮助"可以查看所有指令',
    }
    next()
}

let textHander = {}
textHander.texts = {
    '开始游戏': 'startgame',
    '帮助': 'gethelpmsg',
    'a': 'startgame',
    'd': 'deleteme',
    '工作': 'startwork',
    'b': 'startwork',
    '出售粮食': 'sellcrops',
    'c': 'sellcrops',
    '信息': 'getuserdata',
    'm': 'getuserdata',
    '招募工人': 'recruitworker',
    'recruitworker': 'recruitworker',
    '建筑': 'building',
    'building': 'building',
    '升级农场': 'updatefarm',
    '升级粮仓': 'updategranary',
    '升级围墙': 'updatewall',
    '招募士兵': 'recruitworker',
    '任务': 'getmissions',
    'getmissions': 'getmissions',
}
textHander.handle = (req, res, next) => {
    let text = req.body.text
    if (text in textHander.texts) {
        let method = textHander.texts[text]
        if (method in textHander) {
            textHander[method](req, res, next)
        } else {
            res.body = {
                msgType: 'text',
                content: '该功能可能尚未完成哦'
            }
            next()
        }
    } else {
        res.body = {
            msgType: 'text',
            content: '未知的指令 发送"帮助"可以获得所有指令哦'
        }
        next()
    }
}
textHander.startgame = (req, res, next) => {
    let uid = req.body.uid
    async.waterfall([
        (cb) => {
            User.findOne({uid: uid}, (err, user) => {
                if (user != null) {
                    res.body = {
                        msgType: 'text',
                        content: '你已经开始游戏了哦',
                    }
                    next()
                } else {
                    cb(null)
                }
            })
        },
        (cb) => {
            rds.get('vg-usersum', (err, usersum) => {
                cb(null, usersum)
            })
        },
        (usersum, cb) => {
            api.getUser({openid: uid}, (err, wechatuser) => {
                if (wechatuser == undefined) {
                    res.body = {
                        msgType: 'text',
                        content: '无法获取你的信息',
                    }
                    next()
                    cb(new Error('API error'))
                } else {
                    cb(null, usersum, wechatuser.nickname)
                }
            })
        },
        (usersum, nickname, cb) => {
            let newUser = {
                uid: uid,
                code: usersum,
                nickname: nickname,
            }
            User.create(newUser, (err) => {
                res.body = {
                    msgType: 'text',
                    content: '恭喜你加入了村庄游戏，你现在有1个村民，快点派你的村民去工作吧\n发送"工作"即可派工人去工作哦',
                }
                rds.incr('vg-usersum')
                next()
            })
        }
    ])
}

textHander.gethelpmsg = (req, res, next) => {
    res.body = {
        msgType: 'text',
        content: JSON.stringify(textHander.texts),
    }
    next()
}

textHander.startwork = (req, res, next) => {
    let uid = req.body.uid
    let time = Date.now()
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            if (time - user.last_work_at < 10 * 60 * 1000) {
                res.body = {
                    msgType: 'text',
                    content: '不久之前才刚刚工作过哦'
                }
                next()
            } else {
                let beforecrops = user.crops
                let productcrops = getWorkProduct(user.people, user.building.farm)
                let aftercrops = beforecrops + productcrops
                let limit = getLimit(user.building.granary)
                let msg = ''
                if (aftercrops >= limit) {
                    msg = '，仓库已经堆满了哦，仓库满了之后就不能随时间增长获得粮食了，发送"出售粮食"可以将粮食出售'
                }
                User.update({uid: uid}, {'$set': {last_work_at: time, crops: aftercrops}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `工作获得了${productcrops}粮食🍞${msg}。要过十分钟才能再次工作，这段时间你可以先去做任务（发送"任务"`
                    }
                    next()
                })
            }
        }
    })
}

textHander.deleteme = (req, res, next) => {
    let uid = req.body.uid
    User.remove({uid: uid}, (err) => {
        res.body = {
            msgType: 'text',
            content: '已删除 uid：' + uid
        }
        next()
    })
}

textHander.getuserdata = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let msgtemp = `${user.nickname} 的村庄\n------------------------\nCODE:  ${user.code}\n等级 🌟${getLevel(user.exp)} ${getExpPer(user.exp)}%\n\n粮食🍞 ${user.crops}/${getLimit(user.building.granary)}\n金钱💰 ${user.golds} 💎\n人数👨 ${user.people}\n勋章🎖 ${user.medal}\n ------------------------`
            res.body = {
                msgType: 'text',
                content: msgtemp
            }
            next()
        }
    })
}

textHander.sellcrops = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let aftergolds = user.golds + user.crops
            User.update({uid: uid}, {'$set': {crops: 0, golds: aftergolds}}, (err) => {
                res.body = {
                    msgType: 'text',
                    content: `卖出了${user.crops}粮食，现在有${aftergolds}金钱`
                }
                next()
            })
        }
    })
}

const handlerlist = {
    'event': eventHander,
    'text': textHander,
}

app.use(mp.start())

app.post('/', (req, res, next) => {
    let type = req.body.type
    if (type in handlerlist) {
        handlerlist[type].handle(req, res, next)
    }
}, mp.end())

app.all('/', (req, res) => {
    console.log('--------------------res.body---------------------')
    console.log(res.body)
})

app.listen(80)

// eventHander()
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
