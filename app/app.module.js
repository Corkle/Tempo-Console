angular.module('tempoApp', ['ui.bootstrap'])
    .config(function ($httpProvider) {
        $httpProvider.defaults.useXDomain = true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];
    })
    .filter('duration', function () {
        //Returns duration from milliseconds in hh:mm:ss format.
        return function (millseconds) {
            var seconds = Math.floor(millseconds / 1000);
            var h = 3600;
            var m = 60;
            var hours = Math.floor(seconds / h);
            var minutes = Math.floor((seconds % h) / m);
            var scnds = Math.floor((seconds % m));
            var timeString, hourString = '';
            if (scnds < 10) scnds = "0" + scnds;
            //            if (hours < 10) hours = "0" + hours;
            if (minutes < 10 && hours > 0) minutes = "0" + minutes;
            if (hours > 0) hourString = hours + ":";
            timeString = hourString + minutes + ":" + scnds;
            return timeString;
        };
    })
    .controller('SpotifyCtrl', function ($http, $q) {




        /**
         * Generates a random string containing numbers and letters
         * @param  {number} length The length of the string
         * @return {string} The generated string
         */
        function generateRandomString(length) {
            var text = '';
            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

            for (var i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        }

        /**
         * Obtains parameters from the hash of the URL
         * @return Object
         */
        function getHashParams() {
            var hashParams = {};
            var e, r = /([^&;=]+)=?([^&;]*)/g,
                q = window.location.hash.substring(1);
            while (e = r.exec(q)) {
                hashParams[e[1]] = decodeURIComponent(e[2]);
            }
            return hashParams;
        }

        function getPlaylists(userId, cb) {
            $http({
                    url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
                    method: "GET",
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    }
                })
                .then(function (response) {
                        var playlists = response.data.items;
                        return cb(playlists);
                    },
                    function (result) {
                        DEBUG('error:', result);
                        console.log('Error');
                    });
        }

        function getTracksAsync(playlistUrl, cb) {
            var params = {
                'fields': 'next,items(track(artists,duration_ms,id,name,preview_url))'
            };
            var url = playlistUrl.replace("fields=" + params.fields, "");

            $http({
                    url: url,
                    method: "GET",
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    params: params
                })
                .then(function (response) {
                        var tracks = [];
                        var nextUrl = response.data.next;
                        var items = response.data.items;
                        var tracksChecked = 0;

                        var checkTracksLoaded = function () {
                            if (tracksChecked === items.length) {
                                cb(tracks, nextUrl);
                            }
                        };

                        items.forEach(function (item) {
                            var artists = [];
                            item.track.artists.forEach(function (artist) {
                                artists.push(artist.name);
                            });
                            item.track.artist = artists.join(", ");

                            getTrackData(item.track, function (trackData) {
                                item.track.audio_data = trackData;
                                tracks.push(item.track);
                                tracksChecked++;
                                checkTracksLoaded();
                            }, function (error) {
                                if (error) {
                                    item.track.audio_data = {};
                                    tracks.push(item.track);
                                    tracksChecked++;
                                    checkTracksLoaded();
                                }
                            });
                        });
                    },
                    function (result) {
                        DEBUG('error:', result);
                        console.log('Error');
                    });
        }

        function getTrackData(track, cb, err) {
            var api_key = 'ZALMWFLFASDLR7FHS';
            $http({
                    url: 'http://developer.echonest.com/api/v4/track/profile',
                    method: 'JSONP',
                    params: {
                        api_key: api_key,
                        id: 'spotify:track:' + track.id,
                        format: 'jsonp',
                        callback: 'JSON_CALLBACK',
                        bucket: 'audio_summary'
                    }
                })
                .then(function (response) {
                        if (response.data.response.track) {
                            cb(response.data.response.track.audio_summary);
                        } else err('Track not found.');
                    },
                    function (result) {
                        DEBUG('GetTrackData error:', result);
                        console.log('Error');
                        err(result);
                    });
        }





        var spotifyCtrl = this;
        this.sortType = '';
        this.sortReverse = false;

        this.title = "Tempo Console";

        this.playlists = [];

        var stateKey = 'spotify_auth_state';
        var params = getHashParams();
        var access_token = params.access_token,
            state = params.state,
            storedState = localStorage.getItem(stateKey);

        if (access_token && (state === null || state !== storedState)) {
            alert('There was an error during the authentication');
        } else {
            localStorage.removeItem(stateKey);
            if (access_token) {
                $http({
                        url: 'https://api.spotify.com/v1/me',
                        method: "GET",
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        }
                    })
                    .then(function (response) {
                            spotifyCtrl.userData = response.data;
                            getPlaylists(response.data.id, function (playlists) {
                                spotifyCtrl.playlists = playlists;
                            });
                            spotifyCtrl.showPlaylistData = true;
                        },
                        function (result) {
                            DEBUG('error', result);
                            console.log('Error');
                        });
            } else {

            }
        }




        this.loginUser = function () {
            var client_id = '449c07f2e084462395e230d5ce52ebcd'; // Your client id
            var redirect_uri = 'http://localhost:3000/'; // Your redirect uri

            var state = generateRandomString(16);
            localStorage.setItem(stateKey, state);

            var scope = 'playlist-read-private playlist-modify-public';

            var url = 'https://accounts.spotify.com/authorize';
            url += '?response_type=token';
            url += '&client_id=' + encodeURIComponent(client_id);
            url += '&scope=' + encodeURIComponent(scope);
            url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
            url += '&state=' + encodeURIComponent(state);

            window.location = url;
        };

        this.loadPlaylist = function (playlist) {
            spotifyCtrl.playlistTracks = [];
            getTracksAsync(playlist.href + '/tracks', function updateTracks(trackData, nextUrl) {
                Array.prototype.push.apply(spotifyCtrl.playlistTracks, trackData);
                if (nextUrl) {
                    getTracksAsync(nextUrl, function (a, b) {
                        updateTracks(a, b);
                    });
                }
            });
        };



        //    function getItemInfo(item, cb) {
        //        $http.get(item.url)
        //        .then(function(response) {
        //            cb(response.data);
        //        }, function(response) {console.log('Error')})
        //    }    
        //    
        //    function getCollection(url, cb) {
        //        $http.get(url)
        //        .then(function(response){
        //            var collectionToReturn = [];
        //            
        //            var items = response.data.items;          
        //            items.forEach(function (item) {
        //                getItemInfo(item, function(itemInfo) {
        //                    item.info = itemInfo;
        //                    collectionToReturn.push(item);
        //                    if (collectionToReturn.length == items.length) { //assumes no err responses
        //                        cb(collectionToReturn);
        //                    }
        //                });
        //            })
        //        },
        //             function(response) {console.log('Error');})
        //    }
        //    
        //    var existingCollection = [];
        //    getCollection(collectionUrl, function(collection){
        //        existingCollection.push(collection);
        //    })






    });







function DEBUG(name, item) {
    console.log(name);
    console.log(item);
}