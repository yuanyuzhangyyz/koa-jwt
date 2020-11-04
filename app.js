const Koa = require('koa');
const KoaRouter = require('koa-router');
const KoaBody = require('koa-body');
const mysql2 = require('mysql2');
const parsePath = require('parse-filepath');
const KoaStaticCache = require('koa-static-cache');
const jwtKoa = require('koa-jwt');
const jwt = require('jsonwebtoken');

const app = new Koa();
const router = new KoaRouter();

const connection = mysql2.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'yyz123asd',
    database: 'kkb'
});

app.use((ctx, next) => {
    return next().catch((err) => {
        if (err.status === 401) {
            ctx.status = 401;
            ctx.body = 'Protected resource, use Authorization header to get access\n';
        } else {
            throw err;
        }
    })
})

const secret = 'kkb';
app.use(jwtKoa({
    secret,
    passthrough: true
}).unless({
    path: [/^\/(public|static|login)/]
}));



app.use(KoaStaticCache('./public', {
    prefix: '/public',
    gzip: true,
    dynamic: true
}));
app.use(KoaStaticCache('./static', {
    prefix: '/static',
    gzip: true,
    dynamic: true
}));

router.post('/upload', KoaBody({
    multipart: true,
    formidable: {
        uploadDir: './static/upload',
        keepExtensions: true
    }
}), async ctx => {
    // 验证是否登陆
    console.log("ctx000", ctx);
    let authorization = ctx.get('authorization');
    console.log('authorization000', authorization);

    let token = jwt.verify(authorization, 'kkb');
    console.log('token000', token);


    let {
        attachment
    } = ctx.request.files;

    let fileInfo = parsePath(attachment.path);

    let filename = fileInfo.basename;
    let fileType = attachment.type;
    let fileSize = attachment.size;

    const username = token.name;
    let userResult = await query("select * from `users` where `username`=?", [
        username
    ]);
    let userId = userResult[0].id


    console.log('fileInfo', filename, fileType, fileSize);

    let rs = await query(
        "insert into `attachments` (`filename`, `type`, `size`,`userId`) values (?, ?, ?,?)",
        [
            filename, fileType, fileSize, userId
        ]
    );

    if (rs.affectedRows < 1) {
        ctx.body = '上传失败';
    } else {
        ctx.body = {
            filename
        };
    }

});

router.get('/getPhotos', async ctx => {
    // 从数据库获取上传后的所有图片数据，通过json格式返回给客户端
    // todos
    let authorization = ctx.get('authorization');
    console.log('authorization111*****', authorization, typeof authorization);
  
    if (authorization === "null" || authorization === null) {
        ctx.body = "无权限获取"
    } else {
        let token = jwt.verify(authorization, secret);
        console.log('token111', token);
        const username = token.name;
        let userResult = await query("select * from `users` where `username`=?", [
            username
        ]);
        console.log("userResult", userResult);
        let userId = userResult[0].id


        let rs = await query(
            // 作业中要求数据存储在 photos 表中，但是这里我就不去这么做，大家懂就可以了
            "select * from `attachments` where `userId` = ?", [
                userId
            ])
        ctx.body = rs;
    }
})

router.post('/login', KoaBody(), async ctx => {
    let {
        username,
        password
    } = ctx.request.body;

    console.log('username, password', username, password);

    // 数据库验证过程
    try {
        let rs = await query("select * from `users` where `username`=? AND `password`=?", [
            username, password
        ]);

        if (rs.length !== 0) {
            const token = jwt.sign({
                name: username
            }, secret, {
                expiresIn: '2h'
            });

            ctx.set('authorization', token);
            console.log("rs[0].id", rs[0].id);
            ctx.body = {
                message: '登陆成功',
                id: rs[0].id
            };
            console.log("ctx.body", ctx.body);
        } else {
            ctx.response.status = 401;
            ctx.body = '登陆失败';
        }

    } catch (err) {
        // will only respond with JSON
        console.log("err", err);
        ctx.status = err.statusCode || err.status || 500;
        ctx.body = {
            message: err.message
        };
    }



});

app.use(router.routes());

app.use(function (ctx, next) {
    return next().catch((err) => {
        console.log("err222", err);
        if (401 == err.status) {
            ctx.status = 401;
            ctx.body = 'Protected resource, use Authorization header to get access\n';
        } else {

            throw err;
        }
    });
});

app.listen(8888, () => {
    console.log(`服务启动成功 http://localhost:8888`);
})

function query(sql, data) {
    return new Promise((resolve, reject) => {
        connection.query(
            sql,
            data,
            function (err, ...result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(...result);
                }
            }
        );
    })
}