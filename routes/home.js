const { Router } = require('express')
const passport = require('passport')
const { google } = require('googleapis')
const KEYS = require('../configs/keys')
const multer = require("multer");
const fs = require("fs");
const { gmail } = require('googleapis/build/src/apis/gmail');
var name, pic

const router = Router();

var Storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./files");
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    },
});

var upload = multer({
    storage: Storage,
}).single("file"); //Field name and max count

function isLoggedIn(req, res, next) {
    req.user ? next() : res.sendStatus(401);
}

router.get('/', function (req, res) {
    res.render('home.html', { 'title': 'Application Home' })
});

router.get('/mailhtml', function (req, res) {
    let parseData = {

        googleid: req.user._id,
        name: req.user.name,
        avatar: req.user.pic_url,
        email: req.user.email,

    }
    res.render('mail.html', parseData)
});

router.get('/dashboard', isLoggedIn, async function (req, res) {
    try {
        const oauth2Client = new google.auth.OAuth2()
        oauth2Client.setCredentials({
            'access_token': req.user.accessToken
        });

        let uploadedFiles = await google.drive({ version: "v3", auth: oauth2Client }).files.list();


        let parseData = {
            title: 'DASHBOARD',
            googleid: req.user._id,
            name: req.user.name,
            avatar: req.user.pic_url,
            email: req.user.email,
            uploadedFiles: uploadedFiles
        }

        // if redirect with google drive response
        if (req.query.file !== undefined) {

            // successfully upload
            if (req.query.file == "upload") parseData.file = "uploaded"
            else if (req.query.file == "notupload") parseData.file = "notuploaded"
        }

        res.render('dashboard.html', parseData);

    } catch (error) {
        console.log(error);
    }
});


router.post('/uploadFile', function (req, res) {
    upload(req, res, function (err) {
        if (err) {
            console.log(err);
            return res.end("Something went wrong");
        } else {
            const oauth2Client = new google.auth.OAuth2()
            oauth2Client.setCredentials({
                'access_token': req.user.accessToken
            });
            const drive = google.drive({ version: "v3", auth: oauth2Client });
            const fileMetadata = {
                name: req.file.filename,
            };
            const media = {
                mimeType: req.file.mimetype,
                body: fs.createReadStream(req.file.path),
            };

            const driveResponse = drive.files.create({
                requestBody: {
                    name: req.file.filename,
                    mimeType: req.file.mimetype
                },
                media: {
                    mimeType: req.file.mimetype,
                    body: fs.createReadStream(req.file.path),
                }
            });

            driveResponse.then(data => {

                if (data.status == 200) res.redirect('/dashboard?file=upload') // success
                else res.redirect('/dashboard?file=notupload') // unsuccess

            }).catch(err => { throw new Error(err) })
        }
    });
});


router.post('/sendMail', async function (req, res) {

    console.log(req.body);
    const makeBody = params => {
        params.subject = new Buffer.from(params.subject).toString("base64");
        const str = [
            'Content-Type: text/plain; charset="UTF-8"\n',
            "MINE-Version: 1.0\n",
            "Content-Transfer-Encoding: 7bit\n",
            `to: ${params.to} \n`,
            `from: ${params.from} \n`,
            `subject: =?UTF-8?B?${params.subject}?= \n\n`,
            params.message
        ].join(""); // <--- Modified
        return new Buffer.from(str)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");
    };

    const messageBody = `
      this is a test message
      `;

    const raw = makeBody({
        to: "sashi951109@gmail.com",
        from: req.user.email,
        subject: "test title",
        message: messageBody
    });
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
        'access_token': req.user.accessToken
    });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // gmail.users.messages.send(
    //     {
    //         userId: "me",
    //         resource: {
    //             raw: raw
    //         }
    //     },
    //     (err, res) => { // Modified
    //         if (err) {
    //             console.log(err);
    //             return;
    //         }
    //         console.log(res.data);
    //     }
    // );
    const mailResponse = gmail.users.messages.send({
        userId: "me",
        resource: {
            raw: raw
        }
    });

    mailResponse.then(data => {

        if (data.status == 200) res.redirect('/dashboard?file=sent') // success
        else res.redirect('/dashboard?file=notsent') // unsuccess

    }).catch(err => { throw new Error(err) })



});
// router.post('/uploadFile', async function (req, res) {
//     const oauth2Client = new google.auth.OAuth2()
//     oauth2Client.setCredentials({
//         'access_token': req.user.accessToken
//     });
//     const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
//     gmail.users.labels.list({
//         userId: 'me',
//     }, (err, res) => {
//         if (err) return console.log('The API returned an error: ' + err);
//         const labels = res.data.labels;
//         if (labels.length) {
//             console.log('Labels:');
//             labels.forEach((label) => {
//                 console.log(`- ${label.name}`);
//             });
//         } else {
//             console.log('No labels found.');
//         }
//     });
// });
// logout
router.get('/logout', (req, res) => {
    req.logout();
    // req.session.destroy();
    //res.send('Goodbye!');
    res.redirect('/')
});


module.exports = router;