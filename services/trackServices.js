const { TracksDao, ArtistsDao } = require('../models');
const Sequelize = require('sequelize');
var SpotifyWebApi = require('spotify-web-api-node');
// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: '6dae0a0a5fa14c6094020e079b00904b',
  clientSecret: 'cf8380f02172434882431fafe1b67044'
});


// Retrieve an access token.
spotifyApi.clientCredentialsGrant().then(
  function (data) {
    console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
  },
  function (err) {
    console.log('Something went wrong when retrieving an access token', err);
  }
);

const createTrack = async (isrc, res) => {
  await spotifyApi.searchTracks(`isrc:${isrc}`)
    .then(function (data) {
      console.log(data);
      if (data?.body?.tracks?.items?.length <= 0) {
        res.status(404);
        res.json(
          {
            errorMessage: "ISRC not found in Spotify."
          }
        )
        return res;
      }
      let results = data.body;
      let track = results.tracks;
      let popular = track.items.sort((a, b) => b.popularity - a.popularity)[0];

      TracksDao.create({
        trackId: popular.id, //string
        title: popular.name,
        isrc: popular.external_ids.isrc,
        metadata: popular

      })
        .then((rec) => {
          let artitstsAry = popular.artists.map((ele) => {
            return {
              name: ele.name,
              trackId: rec.dataValues.id
            }
          });
          ArtistsDao.bulkCreate(artitstsAry)
            .then(() => {
              res.status(201);
              res.json({
                status: "Sucess"
              })
              return res;
            })
            .catch(error => {
              console.log(error);
            })

        })
        .catch(error => {
          if (error.name === "SequelizeUniqueConstraintError") {
            res.status(400);
            res.json({
              errorMessage: "Duplicate ISRC code found."
            })
            return res;
          }
          console.log(error);
        })
    }, function (err) {
      console.error(err);
    });
}

const findTracksByIsrc = (isrc, res) => {
  TracksDao.findOne({
    where: { isrc: isrc }
  })
    .then(track => {
      res.json(track);
      return;
    })
    .catch(error => {
      res.status(404).send(error);
      return;
    })
}

const findTracksByArtist = (name, res) => {
  ArtistsDao.findAll({
    where: { name: { [Sequelize.Op.like]: `%${name}%` } },
    include: [{ model: TracksDao, as: 'TrackRef' }]
  })
    .then(artist => {
      res.status(200);
      res.json(artist);
    })
    .catch(error => {
      console.log(error);
      res.status(404).send(error);
    })
  return;
}

module.exports = { createTrack, findTracksByIsrc, findTracksByArtist };