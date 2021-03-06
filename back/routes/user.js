const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { Op } = require('sequelize');
const { User, Post, Image, Comment, } = require('../models');
const { isLoggedIn, isNotLoggedIn } = require('./middlewares');

const router = express.Router();

router.get('/', async (req, res, next) => {//GET/user/
    // console.log('ssr cookie?', req.headers);
    try {
        if (req.user) {
            const fullUserWithoutPassword = await User.findOne({
                where: { id: req.user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                },
                {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            });
            res.status(200).json(fullUserWithoutPassword);
        }
        else {
            req.status(200).json(null);
        }
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.get('/followers', isLoggedIn, async (req, res, next) => {
    try {
        const user = await User.findOne({
            where: { id: req.user.id }
        });
        if (!user) {
            res.status(403).send('없는 사람을 찾으려고 하시네요?');
        }
        const followers = await user.getFollowers({
            limit: parseInt(req.query.limit, 10),
        });
        res.status(200).json(followers);
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.get('/followings', isLoggedIn, async (req, res, next) => {
    try {
        const user = await User.findOne({
            where: { id: req.user.id }
        });
        if (!user) {
            res.status(403).send('없는 사람을 찾으려고 하시네요?');
        }
        const followings = await user.getFollowings({
            limit: parseInt(req.query.limit, 10),
        });
        res.status(200).json(followings);
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.get('/:userId', async (req, res, next) => {//GET/user/1 -특정한 사용자 가져오기
    //wildcard는 되도록 가장 뒤에 배치한다. 안그러면 followers, followings가 :userId에 인식되어 뒤는 실행되지 않는다
    try {
        const fullUserWithoutPassword = await User.findOne({
            where: { id: req.params.userId },
            attributes: {
                exclude: ['password']
            },
            include: [{
                model: Post,
                attributes: ['id'],
            }, {
                model: User,
                as: 'Followings',
                attributes: ['id'],
            },
            {
                model: User,
                as: 'Followers',
                attributes: ['id'],
            }]
        });
        if (fullUserWithoutPassword) {
            const data = fullUserWithoutPassword.toJSON();//시퀄라이즈(mysql작업을 쉽게 하도록 도와주는 라이브러리)에서 보내준 데이터를 json형태로 바꾼다
            console.log('data??', data);
            data.Posts = data.Posts.length;//개인정보 침해 방지
            data.Followers = data.Followers.length;
            data.Followings = data.Followings.length;
            res.status(200).json(data);
        } else {
            res.status(404).json('존재하지 않는 사용자입니다.');
        }


    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.get('/:userId/posts', async (req, res, next) => {//GET/user/1/posts
    try {
        const where = { UserId: req.params.userId };
        if (parseInt(req.query.lastId, 10)) {//초기 로딩이 아닐 때
            where.id = {
                [Op.lt]:
                    parseInt(req.query.lastId, 10)
            }//조건은 lastId보다 작은 게시물 10개를 불러온다, operator의 약자
        }
        const posts = await Post.findAll({
            where,
            limit: 10,//10개만
            //offset: 0,//1~10번까지, 게시글 추가삭제 시 문제가 생김,
            order: [
                ['createdAt', 'DESC'],
            ],
            include: [
                {
                    model: User,
                    attributes: ['id', 'nickname'],
                }, {
                    model: Image,
                },
                {
                    model: Comment,
                    include: [{
                        model: User,
                        attributes: ['id', 'nickname'],

                    }],
                },
                {
                    model: User, //좋아요 누른 사람
                    as: 'Likers',
                    attributes: ['id'],
                },
                {
                    model: Post,
                    as: 'Retweet',
                    include: [{
                        model: User,
                        attributes: ['id', 'nickname'],
                    }, {
                        model: Image,
                    }],
                },
            ],

        });
        // console.log('posts', posts);
        res.status(200).json(posts);
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.post('/login', isNotLoggedIn, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {

        if (err) {
            console.error(err);
            return next(err);
        }
        if (info) {
            // console.log('info?', info.reason);
            return res.status(401).send(info.reason);//인증되지 않음
        }
        return req.login(user, async (loginErr) => {
            if (loginErr) {
                //passport에서 로그인 시 에러가 날 경우
                console.error(loginErr);
                return next(loginErr);
            }
            const fullUserWithoutPassword = await User.findOne({
                where: { id: user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                },
                {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            });
            return res.status(200).json(fullUserWithoutPassword);//사용자정보를 프론트로 넘겨준다
            //res.setHeader('Cookie','cxlyid');
        });
    })(req, res, next);//authenticate 미들웨어 확장법
});
router.post('/', isNotLoggedIn, async (req, res, next) => {
    try {
        const exUser = await User.findOne({
            where: {
                email: req.body.email,
            }
        });
        if (exUser) {
            return res.status(403).send('이미 사용중인 아이디입니다.');
        }
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await User.create({
            email: req.body.email,
            nickname: req.body.nickname,
            password: hashedPassword,
        });
        // res.setHeader('Access-Control-Allow-Origin','*');//브라우저가 cors허용하도록 함
        res.status(201).send('ok');
    }
    catch (error) {
        console.error(error);
        next(error);//status(500)
    }
});

router.post('/logout', isLoggedIn, (req, res) => {
    req.logout();
    req.session.destroy();
    res.send('ok');
});

router.patch('/nickname', async (req, res, next) => {
    try {
        await User.update({
            nickname: req.body.nickname,

        }, {
            where: { id: req.user.id }
        });
        res.status(200).json({ nickname: req.body.nickname });
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});



router.patch('/:userId/follow', isLoggedIn, async (req, res, next) => {
    try {
        const user = await User.findOne({
            where: { id: req.params.userId },
        });
        if (!user) {
            res.status(403).send('유령을 팔로우하려고 하시네요?');
        }
        await user.addFollowers(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.delete('/:userId/follow', async (req, res, next) => {
    try {
        const user = await User.findOne({
            where: { id: req.params.userId },
        });
        if (!user) {
            res.status(403).send('유령을 언팔로우하려고 하시네요?');
        }
        await user.removeFollowers(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
router.delete('/follower/:userId', isLoggedIn, async (req, res, next) => {
    try {
        const user = await User.findOne({
            where: { id: req.params.userId },
        });
        if (!user) {
            res.status(403).send('유령을 차단하려고 하시네요?');
        }
        await user.removeFollowings(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    }
    catch (error) {
        console.error(error);
        next(error);
    }
});
//내가 팔로워를 차단하기
// router.delete('/follower/:userId', async (req, res, next) => {
//     try {
//         const user = await User.findOne({
//             where: { id: req.user.id },
//         });
//         if (!user) {
//             res.status(403).send('유령을 차단하려고 하시네요?');
//         }
//         await user.removeFollowers(req.params.userId);
//         res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
//     }
//     catch (error) {
//         console.error(error);
//         next(error);
//     }
// });

module.exports = router;
