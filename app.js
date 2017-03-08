const config = require('./config.js')
const express = require('express')

// 微信的xml消息处理模块，后面的参数为token
const mp = require('wechat-mp')(config.token)

// 主动API的调用模块，这里是测试信息。正式项目会放到一个config module里读取
const wechatAPI = require('wechat-api')
const api = new wechatAPI(config.appid, config.appsecret)

// mongodb和redis的使用模块，目前均无身份验证信息
const mongoose = require('mongoose')
const User = require('./models/user.js')
const db = mongoose.connect('mongodb://127.0.0.1:27017/vg')
const rds = require('redis').createClient(6379, '127.0.0.1', {})
const async = require('async')
const app = express()
const schedule = require('node-schedule')
const product = require('./product.js')

/**
 * 日常收益的处理
 * 目前每分钟处理一次，数据库并发处理数为1
 */
schedule.scheduleJob('0 * * * * *', () => {
    let start = new Date
    rds.get('vg-usersum', (err, usersum) => {
        async.timesLimit(+usersum, 1, (n, next) => {
            product(n, next)
        }, (err, n) => {
            let now = new Date
            console.log(`start product cron work (${now - start}ms | ${start})`)
        })
    })
})

/**
 *
 * 公共函数，包括了主要的算法和参数信息，后期重构可能会整合进一个module
 * !!数据需要是整数
 ********************************************************************/
const getLevel = exp => exp / 10000 << 0
const getExpPer = exp => (exp % 10000) / 100
const getOutput = (workersum, farmlevel) => {
    return workersum * 10 + farmlevel * 3
}
const getWorkProduct = (workersum, farmlevel) => {
    return getOutput(workersum, farmlevel) * (5 + Math.random() * 5) << 0
}
const getLimit = (granarylevel) => {
    return 3000 + granarylevel * 100
}
const getFarmCost = farmlevel => 100
const getGranaryCost = granarylevel => 100
const getWallCost = walllevel => 10
const getFarmAdd = farmlevel => 3 * farmlevel
const getGranaryAdd = granarylevel => 100 * granarylevel
const getWallAdd = walllevel => walllevel
const getAttackObtainGolds = (crops, golds) => (crops / 100 + 0.5 * (Math.random() * 3 + 1) << 0) + (golds / 100 << 0)
const getAttackObtainMedal = enemyexp => (getLevel(enemyexp) + 0.5 << 0) + (Math.random() + 0.3 << 0)
const getAttackCost = (crops, walllevel) => (crops / 100 * (Math.random() * 2 + 1) << 0) + walllevel
const missions = {
    sum: 3,
    1: {
        name: '野狼驱逐⭐',
        description: '一个遥远地方的村落苦受野狼侵扰，需要救援。他们的牛奶都被偷喝了。他们悬赏2💰希望得到您的援手，你需要派遣1名士兵以拯救他们',
        cost: 1,
        obtain: 2,
        probability: 0.5
    },
    2: {
        name: '保镖护行⭐⭐',
        description: '一支商队经过了您的村庄。他们向你请求保护，他们需要5名士兵，你可以从中赚取9💰',
        cost: 5,
        obtain: 9,
        probability: 0.7
    },
    3: {
        name: '拯救村落⭐⭐⭐',
        description: '山贼们袭击了一个村落。他们的村长向您求助，您需要15名士兵来击败那些山贼。事成之后可以获得23💰',
        cost: 15,
        obtain: 23,
        probability: 0.8
    }
}
/*********************************************************************/


let eventHander = {}

/**
 * 事件的处理，现在只简单的有的分发处理一下，未知的直接会空消息
 */
eventHander.handle = (req, res, next) => {
    let event = req.body.param.event
    if (event in eventHander) {
        eventHander[event](req, res, next)
    } else {
        res.body = {}
        next()
    }
}

/**
 * 订阅事件的处理，当前只提示欢迎信息，没有其他处理
 */
eventHander.subscribe = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '欢迎来到村庄游戏，这是微信上的第一款策略游戏。你可以生产粮食🍞，将他们出售💰，进行任务，攻击其他玩家，并且发展你的村庄！\n开始游戏吧！\n发送"开始游戏"可以开始游戏\n发送"帮助"可以查看所有指令\n游戏目前正在测试，可以随便修改数据，删除数据。有任何问题请联系微信cnWangJie000',
            }
            next()
        } else {
            res.body = {
                msgType: 'text',
                content: '欢迎回到村庄游戏'
            }
            next()
        }
    })
}

let textHander = {}

/**
 * 文字信息对应的函数的对象数组，后面会加入i18n的功能
 */
textHander.texts = {
    '开始游戏': 'startgame',
    '帮助': {
        type: 'normal',
        description: '获取所有指令',
        name: 'gethelpmsg'
    },
    '二维码': {
        type: 'normal',
        description: '获得本公众号二维码',
        name: 'getqrcode'
    },
    '消息': {
        type: 'normal',
        description: '获得游戏信息',
        name: 'getgamemsg'
    },
    '设置昵称': {
        type: 'param',
        paramsum: 1,
        description: '后面跟一个空格加上你想设置的昵称',
        name: 'setnickname'
    },
    'h': 'gethelpmsg',
    'a': 'startgame',
    'd': 'deleteme',
    '工作': {
        type: 'normal',
        description: '每次工作可以获得随机粮食',
        name: 'startwork'
    },
    'b': 'startwork',
    '出售粮食': {
        type: 'normal',
        description: '出售粮食',
        name: 'sellcrops'
    },
    'c': 'sellcrops',
    '信息': {
        type: 'normal',
        description: '查看当前的玩家信息',
        name: 'getuserdata',
    },
    'm': 'getuserdata',
    'g': 'getmydata',
    '招募工人': {
        type: 'normal',
        description: '招募工人',
        name: 'recruitworker'
    },
    'recruitworker': 'recruitworker',
    'set': {
        group: 'admin',
        type: 'param',
        paramsum: 2,
        name: '$set'
    },
    '建筑': {
        type: 'normal',
        description: '查看当前的建筑信息',
        name: 'building'
    },
    'building': 'building',
    '升级农场': 'updatefarm',
    '升级粮仓': 'updategranary',
    '升级围墙': 'updatewall',
    '招募士兵': 'recruitworker',
    '任务': {
        type: 'normal',
        description: '寻找一个任务',
        name: 'getmissions'
    },
    'l': 'getmissions',
    'getmissions': 'getmissions',
    '邀请人': {
        type: 'param',
        description: '设置邀请人',
        paramsum: 1,
        name: 'beinvitedby'
    },
    '排行榜': {
        type: 'normal',
        description: '查看排行榜',
        name: 'getrank'
    },
    'r': 'getrank',
    '寻找敌人': {
        type: 'normal',
        description: '攻击其他玩家，获得荣誉',
        name: 'findenemy'
    },
    'f': 'findenemy',
    '进攻': {
        type: 'param',
        paramsum: 1,
        name: 'attack'
    },
    '增援': 'reinforce',
    '放弃': 'giveup',
    '执行任务': 'executemission',
    'e': 'executemission'
}

/**
 * 处理文字消息
 * 普通的函数只要在对照数组里写上方法名即可
 * 如果函数没有实现会返回功能尚未完成的信息，程序不会终止
 * 需要参数的需要一个对象，格式为{ type: 'param', paramsum: n, name: methodname }
 * 格式必须规范否则直接报错程序终止
 *
 */
textHander.handle = (req, res, next) => {
    let text = req.body.text
    let params = text.split(' ')
    if (params[0] in textHander.texts) {
        let method = textHander.texts[params[0]]
        if (method in textHander) {
            textHander[method](req, res, next)
        } else if ('type' in method && method.type == 'normal') {
            if (method.name in textHander) {
                textHander[method.name](req, res, next)
            } else {
                res.body = {
                    msgType: 'text',
                    content: '该功能可能尚未完成哦'
                }
                next()
            }
        } else if ('type' in method && method.type == 'param') {
            params.shift()
            if (params.length != method.paramsum) {
                res.body = {
                    msgType: 'text',
                    content: `参数的数量不对哦，这个命令应该有${method.paramsum}个参数`
                }
                next()
            } else if (method.name in textHander) {
                textHander[method.name](req, res, next, params)
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

/**
 * 开始游戏，先判断是否已经开始，否则根据api获得用户昵称，游戏人数作为id，插入数据，游戏人数加一
 *
 */
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
                if (wechatuser == undefined || !'nickname' in wechatuser) {
                    res.body = {
                        msgType: 'text',
                        content: '现在暂时无法获取你的信息，稍后再试吧',
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

/**
 * 返回所有指令信息
 */
textHander.gethelpmsg = (req, res, next) => {
    if (!'helpmsg' in textHander || !textHander.helpmsg) {
        textHander.helpmsg = '帮助\n-------------'
        for (let m in textHander.texts) {
            let e = textHander.texts[m]
            if (typeof e == 'string') {

            } else if ('description' in e) {
                textHander.helpmsg += `\n${m}: ${e.description}`
            }
        }
    }
    res.body = {
        msgType: 'text',
        content: textHander.helpmsg
    }
    next()
}

/**
 * 开始工作
 * 间隔10分钟才可工作一次，工作一次可随机获得五到十分钟的收益
 */
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

/**
 * 测试功能，用于删除用户数据
 */
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

/**
 * 测试功能，用于获取用户数据
 */
textHander.getmydata = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        res.body = {
            msgType: 'text',
            content: JSON.stringify(user, null, 2)
        }
        next()
    })
}

/**
 * 测试功能，用于修改用户数据
 */
textHander.$set = (req, res, next, params) => {
    let code = params[0]
    let mod = JSON.parse(params[1])
    User.update({code: code}, {'$set': mod}, (err) => {
        res.body = {
            msgType: 'text',
            content: `成功设置code为${code}的用户数据${params[1]}`
        }
        next()
    })
}

/**
 * 消息
 */
textHander.getgamemsg = (req, res, next) => {
    rds.get('vg-usersum', (err, usersum) => {
        res.body = {
            msgType: 'text',
            content: `目前有${usersum}名玩家\n\n有任何问题请联系微信cnWangJie000或QQ924897716，当前数据和游戏平衡性还尚未测试，欢迎各种提意见。可惜个人号没有客服消息和自定义菜单权限，导致游戏比较麻烦，请见谅。`
        }
        next()
    })
}

/**
 * 获取用户信息，当前模板大致如下
 *
 * XXXXX 的村庄
 * ------------------------
 * CODE: XX
 * 等级🌟 XX XX%
 *
 * 粮食🍞 XXXX/XXXX
 * 金钱💰 XXXX 💎
 * 人数👨 XXXX
 * 勋章🎖 X
 *  ------------------------
 */
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

/**
 * 出售粮食，当前一粮食抵一金币
 */
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
            User.update({uid: uid}, {'$set': {exp: user.exp + user.crops, crops: 0, golds: aftergolds}}, (err) => {
                res.body = {
                    msgType: 'text',
                    content: `卖出了${user.crops}粮食，现在有${aftergolds}金钱`
                }
                next()
            })
        }
    })
}

/**
 * 招募工人，其实只是告诉玩家获得工人的方法而已
 */
textHander.recruitworker = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            res.body = {
                msgType: 'text',
                content: `只要将这个游戏分享给你的朋友，让他们发送"邀请人 ${user.code}"你和他就都可以获得一名工人和100金钱。`
            }
            next()
        }
    })
}

/**
 * 给用户设置邀请人id，给邀请者和被邀请者加一个工人和100金钱
 *  - 之后可能会给邀请人推送消息
 */
textHander.beinvitedby = (req, res, next, params) => {
    let uid = req.body.uid
    let code = params[0]
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else if (user.inviter_id != null) {
            res.body = {
                msgType: 'text',
                content: '你已经设置过邀请人了哦'
            }
            next()
        } else if (code == user.code) {
            res.body = {
                msgType: 'text',
                content: '你自己邀请的自己？！'
            }
            next()
        } else {
            User.findOne({code: code}, (err, inviter) => {
                if (inviter == null) {
                    res.body = {
                        msgType: 'text',
                        content: '邀请人不存在，和邀请你的人确认一哈。请不要试图随便输一个code（笑'
                    }
                    next()
                } else {
                    User.update({uid: uid}, {'$set': {people: user.people + 1, golds: user.golds + 100, inviter_id: code}}, (err) => {
                        User.update({code: code}, {'$set': {people: inviter.people + 1, golds: inviter.golds + 100}}, (err) => {
                            res.body = {
                                msgType: 'text',
                                content: '恭喜你获得一名工人和100金钱'
                            }
                            next()
                        })
                    })
                }
            })
        }
    })
}

/**
 * 返回建筑等级信息和升级方法
 */
textHander.building = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let buildings = user.building
            let msgtemp = `你可以透過興建各種建築🏡來增強您的村落🏘。\n\n农场 (等級 ${buildings.farm}) 每分钟额外制造粮食\n当前: +${getFarmAdd(buildings.farm)}🍞 升级后: +${getFarmAdd(buildings.farm + 1)}🍞 价格: ${getFarmCost(buildings.farm + 1)}💰\n发送"升级农场"升级\n\n粮仓 (等級 ${buildings.granary}) 增加粮食上限\n当前: +${getGranaryAdd(buildings.granary)}🍞 升级后: +${getGranaryAdd(buildings.granary + 1)}🍞 价格: ${getGranaryCost(buildings.granary + 1)}💰\n发送"升级粮仓"升级\n\n围墙 (等級 ${buildings.wall})  提升被攻击时的防御力\n当前: +${getWallAdd(buildings.wall)}🛡 升级后: +${getWallAdd(buildings.wall + 1)}🛡 价格: ${getWallCost(buildings.wall)}💰\n发送"升级围墙"升级\n\n当前金钱💰 ${user.golds}`
            res.body = {
                msgType: 'text',
                content: msgtemp
            }
            next()
        }
    })
}

/*******************************************************
 * 下面升级建筑的函数其实都是一个套路，如果今后要增加建筑的种类可能会重构，不然就先这么放着了
 *******************************************************/

/**
 * 升级农场
 */
textHander.updatefarm = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getFarmCost(user.building.farm + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.golds}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building: {farm: user.building.farm + 1}, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 升级粮仓
 */
textHander.updategranary = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getGranaryCost(user.building.granary + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.granary}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building: {granary: user.building.granary + 1}, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 升级围墙
 */
textHander.updatewall = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getWallCost(user.building.wall + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.golds}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building: {wall: user.building.wall + 1}, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 寻找敌人，根据等级寻找
 */
textHander.findenemy = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else if (user.golds < 1) {
            res.body = {
                msgType: 'text',
                content: '寻找敌人需要花费1个金币哦，可你一个金币也没有。先去把粮食出售掉换点金币吧'
            }
            next()
        } else {
            User.explike(uid, user.exp, 10000, (err, enemys) => {
                if (enemys.length == 0) {
                    User.update({uid: uid}, {'$set': {golds: user.golds - 1, enemys: null}})
                    res.body = {
                        msgType: 'text',
                        content: '附近没有发现敌人，先去做做任务吧。。'
                    }
                    next()
                } else {
                    let handledenemys = {}
                    let msgtemp = `你花费了1个金币找到了${enemys.length}个附近的敌人`
                    for (a of enemys) {
                        let tmp = {
                            code: a.code,
                            nickname: a.nickname,
                            obtaingolds: getAttackObtainGolds(a.crops, a.golds),
                            obtainmedal: getAttackObtainMedal(a.exp),
                            cost: getAttackCost(a.crops, a.building.wall),
                        }
                        handledenemys[a.code] = tmp
                        msgtemp += `\n\n${tmp.nickname} 的村庄\n--------------\n可获得${tmp.obtaingolds}💰，${tmp.obtainmedal}🎖\n需要花费${tmp.cost}💰雇佣士兵\n发送"进攻 ${tmp.code}"发起进攻`
                    }
                    User.update({uid: uid}, {'$set': {golds: user.golds - 1, attack: {status: 'fond', enemys: JSON.stringify(handledenemys)}}}, (err) => {
                        res.body = {
                            msgType: 'text',
                            content: msgtemp
                        }
                        next()
                    })
                }
            })
        }
    })
}

/**
 * 进攻，第一个参数为被进攻的人的code
 */
textHander.attack = (req, res, next, params) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else if (user.attack.status != 'fond') {
            res.body = {
                msgType: 'text',
                content: '找不到这名玩家哦'
            }
            next()
        } else {
            let enemys = JSON.parse(user.attack.enemys)
            let code = params[0]
            if (!code in enemys) {
                res.body = {
                    msgType: 'text',
                    content: '这名玩家不在你的附近哦'
                }
                next()
            } else {
                let b = enemys[code]
                if (user.golds < b.cost) {
                    res.body = {
                        msgType: 'text',
                        content: '你没有足够的钱发起攻击'
                    }
                    next()
                } else {
                    if (Math.random() > 0.4) {
                        User.update({uid: uid}, {'$set': {exp: user.exp + b.obtainmedal * 100, golds: user.golds - b.cost + b.obtaingolds, medal: user.medal + b.obtainmedal, attack: {status: 'end', enemys: ''}}}, (err) => {
                            res.body = {
                                msgType: 'text',
                                content: `你成功击败了${b.nickname}，获得了${b.obtaingolds}💰和${b.obtainmedal}🎖`
                            }
                            next()
                        })
                    } else {
                        b.cost = b.cost * (Math.random() * 1 + 0.3) << 0
                        User.update({uid: uid}, {'$set': {golds: user.golds - b.cost, attack: {status: 'need', enemys: JSON.stringify(b)}}}, (err) => {
                            res.body = {
                                msgType: 'text',
                                content: `进攻的部队不幸被敌人包围，需要花费${b.cost}💰派兵增援或者选择试图跑路\n发送"增援"派兵增援\n发送"放弃"可以跑路`
                            }
                            next()
                        })
                    }
                }
            }
        }
    })
}

/**
 * 增援，不知道需不需要再次出现几率失败。平衡性不好怕被玩家喷
 */
textHander.reinforce = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else if (user.attack.status != 'need') {
            res.body = {
                msgType: 'text',
                content: '增援？啥？'
            }
            next()
        } else {
            let b = JSON.parse(user.attack.enemys)
            if (user.golds < b.cost) {
                res.body = {
                    msgType: 'text',
                    content: `你没有足够的钱发起增援，你可以选择放弃，也可以稍晚一点再增援`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {golds: user.golds - b.cost + b.obtaingolds, medal: user.medal + b.obtainmedal, attack: {status: 'end', enemys: ''}}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `你成功击败了${b.nickname}，获得了${b.obtaingolds}💰和${b.obtainmedal}🎖`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 获取任务。。。这是个坑，可以完全照搬进攻，也可以重做
 */
textHander.getmissions = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let missionid = Math.random() * missions.sum + 1 << 0
            console.log(missionid)
            let missiondetail = {
                cost: missions[missionid].cost,
                obtain: missions[missionid].obtain,
                probability: missions[missionid].probability
            }
            User.update({uid: uid}, {'$set': {mission: {status: 'fond', detail: JSON.stringify(missiondetail), last_exec_at: user.mission.last_exec_at}}}, (err) => {
                res.body = {
                    msgType: 'text',
                    content: '你找到了一个任务，发送"执行任务"即可执行\n\n' + missions[missionid].description
                }
                next()
            })
        }
    })
}

/**
 * 执行任务，基本上和攻击差不多，但是很蛋疼，不怎么好玩，待重构
 */
textHander.executemission = (req, res, next) => {
    let uid = req.body.uid
    let time = Date.now()
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else if (user.mission.status != 'fond') {
            res.body = {
                msgType: 'text',
                content: '你现在还没有任务哦'
            }
            next()
        } else if (time - user.mission.last_exec_at < 45 * 1000) {
            res.body = {
                msgType: 'text',
                content: '你不久之前才执行过任务哦，歇一会吧'
            }
            next()
        } else {
            let m = JSON.parse(user.mission.detail)
            if (user.golds < m.cost) {
                res.body = {
                    msgType: 'text',
                    content: `执行这个任务需要${m.cost}💰，可你只有${user.golds}💰`
                }
                next()
            } else if (Math.random() > m.probability) {``
                User.update({uid: uid}, {'$set': {golds: user.golds - m.cost, mission: {status: 'end', detail: null, last_exec_at: time}}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `_(´ཀ\`」 ∠)_, 任务失败了，白花${m.cost}💰`
                    }
                    next()
                })
            } else {
                User.update({uid: uid}, {'$set': {exp: user.exp + m.obtain * 10, golds: user.golds - m.cost + m.obtain, mission: {status: 'end', detail: null, last_exec_at: time}}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `任务成功，获得了${m.obtain}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 获取排名
 */
textHander.getrank = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            User.alltop(10, (err, alltop) => {
                User.lvtop(getLevel(user.exp), 5, (err, lvtop) => {
                    let msgtemp = `全服前 10 :`
                    for (let p of alltop) {
                        msgtemp += `\n${p.nickname} lv.${getLevel(p.exp)} 🎖${p.medal}`
                    }
                    msgtemp += `\n------------\n${getLevel(user.exp)}级前 5 :\n`
                    for (let p of alltop) {
                        msgtemp += `\n${p.nickname} 🎖${p.medal}`
                    }
                    msgtemp += `\n------------\n${user.nickname} 🎖${user.medal}\n`
                    res.body = {
                        msgType: 'text',
                        content: msgtemp
                    }
                    next()
                })
            })
        }
    })
}

/**
 * 设置昵称
 */
textHander.setnickname = (req, res, next, params) => {
    let uid = req.body.uid
    let nickname = params[0]
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            User.update({uid: uid}, {'$set': {nickname: nickname}}, (err) => {
                res.body = {
                    msgType: 'text',
                    content: `成功设置昵称：${nickname}`
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

/**
 * 用于接受微信发送的xml消息，路径可改
 */
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
