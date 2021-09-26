const { Router } = require('express')
const passport = require('passport')
const { google } = require('googleapis')
const KEYS = require('../configs/keys')
const multer = require("multer");
const fs = require("fs");
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

router.get('/dashboard', isLoggedIn, function (req, res) {

    // // if not user
    // if (typeof req.user == "undefined") res.redirect('/auth/login/google')
    // else {

    let parseData = {
        title: 'DASHBOARD',
        googleid: req.user._id,
        name: req.user.name,
        avatar: req.user.pic_url,
        email: req.user.email
    }

    // if redirect with google drive response
    if (req.query.file !== undefined) {

        // successfully upload
        if (req.query.file == "upload") parseData.file = "uploaded"
        else if (req.query.file == "notupload") parseData.file = "notuploaded"
    }

    res.render('dashboard.html', parseData);
});

//                 }
//             );
//         }
//     });
//     // // auth user

//     // config google drive with client token
//     const oauth2Client = new google.auth.OAuth2()
//     oauth2Client.setCredentials({
//         'access_token': req.user.accessToken
//     });

//     const drive = google.drive({
//         version: 'v3',
//         auth: oauth2Client
//     });

//     //move file to google drive

//     let { name: filename, mimetype, data } = req.files.file_upload

//     const driveResponse = drive.files.create({
//         requestBody: {
//             name: filename,
//             mimeType: mimetype
//         },
//         media: {
//             mimeType: mimetype,
//             body: Buffer.from(data).toString()
//         }
//     });

//     driveResponse.then(data => {

//         if (data.status == 200) res.redirect('/dashboard?file=upload') // success
//         else res.redirect('/dashboard?file=notupload') // unsuccess

//     }).catch(err => { throw new Error(err) })

// });



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

// logout
router.get('/logout', (req, res) => {
    req.logout();
    // req.session.destroy();
    //res.send('Goodbye!');
    res.redirect('/')
});


module.exports = router;