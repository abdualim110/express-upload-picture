var aws = require('aws-sdk')
var express = require('express');
var fileUpload = require('express-fileupload');
var router = express.Router();
var mongoose = require('mongoose'); //mongo connection
var bodyParser = require('body-parser'); //parses information from POST
var methodOverride = require('method-override'); //used to manipulate POST
var multiparty = require('multiparty');
var multer  = require('multer');
var multerS3 = require('multer-s3')
var fs = require('fs');
if (process.env.NODE_ENV == "production"){
  var s3 = new aws.S3({accessKeyId: process.env.S3_ACCESS_KEY_ID , secretAccessKey: process.env.S3_SECRET_ACCESS_KEY});
  var upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_FOG_DIRECTORY,
      acl: 'aws-exec-read',
      metadata: function (req, file, cb) {
        cb(null, {fieldName: file.fieldname});
      },
      key: function (req, file, cb) {
        console.log(process.env.S3_ACCESS_KEY_ID)
        var name = file.originalname
        var extension = name.substr(name.lastIndexOf(".") + 1);
        cb(null, file.fieldname + '-' + Date.now()+'.'+extension);
      }
    })
  })
}else{
  var storage = multer.diskStorage({
    destination: function (req, file, callback) {
      callback(null, 'public/uploads/pictures');
    },
    filename: function (req, file, callback) {
      var name = file.originalname
      var extension = name.substr(name.lastIndexOf(".") + 1);
      callback(null, file.fieldname + '-' + Date.now()+'.'+extension);
    }
  });
  var upload = multer({ storage : storage })
}

router.use(bodyParser.urlencoded({ extended: true }))
router.use(methodOverride(function(req, res){
      if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        // look in urlencoded POST bodies and delete it
        var method = req.body._method
        delete req.body._method
        return method
      }
}))

router.route('/')
    //GET all pictures
    .get(function(req, res, next) {
        //retrieve all pictures from Monogo
        mongoose.model('Picture').find({}, function (err, pictures) {
              if (err) {
                  return console.error(err);
              } else {
                  //respond to both HTML and JSON. JSON responses require 'Accept: application/json;' in the Request Header
                  res.format({
                      //HTML response will render the index.jade file in the views/pictures folder. We are also setting "pictures" to be an accessible variable in our jade view
                    html: function(){
                        res.render('pictures/index', {
                              title: 'List all my pictures',
                              "pictures" : pictures
                          });
                    },
                    //JSON response will show all pictures in JSON format
                    json: function(){
                        res.json(pictures);
                    }
                });
              }
        });
    })
    //POST a new picture

    .post(upload.single('sampleFile'), function(req, res) {
        // Get values from POST request. These can be done through forms or REST calls. These rely on the "name" attributes for forms
        var file =""
        var name = req.body.name;
        if (process.env.NODE_ENV != "production"){
          console.log(req.file.path)
          var file = req.file.path.replace('public/', '');
        }else{
          console.log(req.file)
          var file = req.file.location
        }
        var created_at = new Date();
        //call the create function for our database
        mongoose.model('Picture').create({
            name : name,
            file : file,
            created_at: created_at
        }, function (err, picture) {
              if (err) {
                  res.send("There was a problem adding the information to the database.");
              } else {
                  //picture has been created
                  console.log('POST creating new picture: ' + picture);
                  res.format({
                      //HTML response will set the location and redirect back to the home page. You could also create a 'success' page if that's your thing
                    html: function(){
                        // If it worked, set the header so the address bar doesn't still say /adduser
                        res.location("pictures");
                        // And forward to success page
                        res.redirect("/pictures");
                    },
                    //JSON response will show the newly created picture
                    json: function(){
                        res.json(picture);
                    }
                });
              }
        })
    });

/* GET New picture page. */
router.get('/new', function(req, res) {
    res.render('pictures/new', { title: 'Add New Picture' });
});

// route middleware to validate :id
router.param('id', function(req, res, next, id) {
    //console.log('validating ' + id + ' exists');
    //find the ID in the Database
    mongoose.model('Picture').findById(id, function (err, picture) {
        //if it isn't found, we are going to repond with 404
        if (err) {
            console.log(id + ' was not found');
            res.status(404)
            var err = new Error('Not Found');
            err.status = 404;
            res.format({
                html: function(){
                    next(err);
                 },
                json: function(){
                       res.json({message : err.status  + ' ' + err});
                 }
            });
        //if it is found we continue on
        } else {
            //uncomment this next line if you want to see every JSON document response for every GET/PUT/DELETE call
            //console.log(picture);
            // once validation is done save the new item in the req
            req.id = id;
            // go to the next thing
            next();
        }
    });
});

router.route('/:id')
  .get(function(req, res) {
    mongoose.model('Picture').findById(req.id, function (err, picture) {
      if (err) {
        console.log('GET Error: There was a problem retrieving: ' + err);
      } else {
        console.log('GET Retrieving ID: ' + picture._id);
        res.format({
          html: function(){
              res.render('pictures/show', {
                "picture" : picture
              });
          },
          json: function(){
              res.json(picture);
          }
        });
      }
    });
  });

router.route('/:id/edit')
  //GET the individual picture by Mongo ID
  .get(function(req, res) {
      //search for the picture within Mongo
      mongoose.model('Picture').findById(req.id, function (err, picture) {
          if (err) {
              console.log('GET Error: There was a problem retrieving: ' + err);
          } else {
              //Return the picture
              console.log('GET Retrieving ID: ' + picture._id);
              var picturedob = picture.dob.toISOString();
              picturedob = picturedob.substring(0, picturedob.indexOf('T'))
              res.format({
                  //HTML response will render the 'edit.jade' template
                  html: function(){
                         res.render('pictures/edit', {
                            title: 'picture' + picture._id,
                            "picturedob" : picturedob,
                            "picture" : picture
                        });
                   },
                   //JSON response will return the JSON output
                  json: function(){
                         res.json(picture);
                   }
              });
          }
      });
  })
  //PUT to update a picture by ID
  .put(function(req, res) {
      // Get our REST or form values. These rely on the "name" attributes
      var name = req.body.name;

      //find the document by ID
      mongoose.model('Picture').findById(req.id, function (err, picture) {
          //update it
          picture.update({
              name : name
          }, function (err, pictureID) {
            if (err) {
                res.send("There was a problem updating the information to the database: " + err);
            }
            else {
                    //HTML responds by going back to the page or you can be fancy and create a new view that shows a success page.
                    res.format({
                        html: function(){
                             res.redirect("/pictures/" + picture._id);
                       },
                       //JSON responds showing the updated values
                      json: function(){
                             res.json(picture);
                       }
                    });
             }
          })
      });
  })
  //DELETE a picture by ID
  .delete(function (req, res){
      //find picture by ID
      mongoose.model('Picture').findById(req.id, function (err, picture) {
          if (err) {
              return console.error(err);
          } else {
              //remove it from Mongo and remove picture
              console.log(picture.file)
              if (process.env.NODE_ENV != 'production')
              {
                fs.unlinkSync('public/'+picture.file);
              }else{
                var picture_name = picture.file
                var picture_key = picture_name.substr(picture_name.lastIndexOf("/") + 1);
                console.log(picture_key)
                s3.deleteObject({
                  Bucket: process.env.S3_FOG_DIRECTORY,
                  Key: picture_key
                });
              }
              console.log('successfully deleted image');
              picture.remove(function (err, picture) {
                  if (err) {
                      return console.error(err);
                  } else {
                      //Returning success messages saying it was deleted
                      console.log('DELETE removing ID: ' + picture._id);
                      res.format({
                          //HTML returns us back to the main page, or you can create a success page
                            html: function(){
                                 res.redirect("/pictures");
                           },
                           //JSON returns the item with the message that is has been deleted
                          json: function(){
                                 res.json({message : 'deleted',
                                     item : picture
                                 });
                           }
                        });
                  }
              });
          }
      });
  });

module.exports = router;
