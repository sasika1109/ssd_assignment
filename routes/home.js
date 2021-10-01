const { Router } = require('express')
const passport = require('passport')
const { google } = require('googleapis')
const KEYS = require('../configs/keys')
const multer = require("multer");
const fs = require("fs");
const { gmail } = require('googleapis/build/src/apis/gmail');
var name, pic

const router = Router();

// mulger storage configuration for file uploading
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

// landing page route
router.get('/', function (req, res) {
    res.render('home.html', { 'title': 'Application Home' })
});


// delete files from Google Drive
router.post('/deleteFile', async function (req, res) {

    try {
        const oauth2Client = new google.auth.OAuth2()
        oauth2Client.setCredentials({
            'access_token': req.user.accessToken
        });

        let deleteFile = await google.drive({
            version: "v3",
            auth: oauth2Client
        }).files.delete({ fileId: req.body.item_id });

        if (deleteFile.status === 204) {
            res.redirect('/dashboard?file=deleted');
        } else {
            res.redirect('/dashboard?file=not_deleted');
        }
    } catch (e) {
        res.redirect('/dashboard?file=not_deleted');
    }
});

// load dashboard items
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
            uploadedFiles: uploadedFiles.data.files
        }

        // if redirect with google drive response
        if (req.query.file !== undefined) {
            // successfully upload
            if (req.query.file == "upload") parseData.file = "uploaded"
            else if (req.query.file == "notupload") parseData.file = "notuploaded"
            else if (req.query.file == "deleted") parseData.file = "deleted"
            else if (req.query.file == "not_deleted") parseData.file = "not_deleted"
        }

        if (req.query.email !== undefined) {
            if (req.query.email == "sent") parseData.email = "sent"
            else if (req.query.email == "notsent") parseData.email = "notsent"
        }

        res.render('dashboard.html', parseData);

    } catch (error) {
        console.log(error);
    }
});

// upload files
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

// send email
router.post('/sendMail', async function (req, res) {

    const constructBody = params => {
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

    const raw = constructBody({
        to: req.body.to,
        from: req.user.email,
        subject: req.body.subject,
        message: req.body.message
    });

    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({
        'access_token': req.user.accessToken
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const mailResponse = gmail.users.messages.send({
        userId: "me",
        resource: {
            raw: raw
        }
    });

    mailResponse.then(data => {
        if (data.status == 200) res.redirect('/dashboard?email=sent') // success
        else res.redirect('/dashboard?email=notsent') // unsuccess

    }).catch(err => { throw new Error(err) })
});

// logout
router.get('/logout', (req, res) => {
    req.logout();
    // req.session.destroy();
    //res.send('Goodbye!');
    res.redirect('/')
});

module.exports = router;