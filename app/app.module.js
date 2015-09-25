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

        function getPlaylistsAsync(userId) {
            var defer = $q.defer();
            $http({
                    url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
                    method: "GET",
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    }
                })
                .then(function (response) {
                        var playlists = response.data.items;
                        defer.resolve(playlists);
                    },
                    function (result) {
                        defer.reject(result);
                    });
            return defer.promise;
        }

        function getTracksAsync(playlistUrl) {
            var defer = $q.defer();
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
                                defer.resolve(tracks, nextUrl);
                            }
                        };

                        items.forEach(function (item) {
                            var artists = [];
                            item.track.artists.forEach(function (artist) {
                                artists.push(artist.name);
                            });
                            item.track.artist = artists.join(", ");

                            getTrackDataAsync(item.track)
                                .then(function (trackData) {
                                    item.track.audio_data = trackData;
                                    tracks.push(item.track);
                                    tracksChecked++;
                                    checkTracksLoaded();
                                }, function (err) {
                                    if (err) {
                                        item.track.audio_data = {};
                                        tracks.push(item.track);
                                        tracksChecked++;
                                        checkTracksLoaded();
                                    }
                                });
                        });
                    },
                    function (err) {
                        defer.reject(err);
                    });
            return defer.promise;
        }

        function getTrackDataAsync(track) {
            var defer = $q.defer();
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
                            defer.resolve(response.data.response.track.audio_summary);
                        } else {
                            defer.reject('Track not found.');
                        }
                    },
                    function (err) {
                        DEBUG('GetTrackDataAsync error:', err);
                        console.log('Error');
                        defer.reject(err);
                    });
            return defer.promise;
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
                            getPlaylistsAsync(response.data.id)
                                .then(function (playlists) {
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
            getTracksAsync(playlist.href + '/tracks')
                .then(function updateTracks(trackData, nextUrl) {
                        Array.prototype.push.apply(spotifyCtrl.playlistTracks, trackData);
                        if (nextUrl) {
                            getTracksAsync(nextUrl)
                                .then(function (a, b) {
                                    updateTracks(a, b);
                                });
                        }
                    },
                    function (error) {
                        console.log('Failed to load tracks');
                    });
        };



        //        function getItemInfoAsync(item) {
        //            var defer = $q.defer();
        //            $http.get(item.url)
        //                .then(function (response) {
        //                    defer.resolve(response.data);
        //                }, function (error) {
        //                    defer.reject(error);
        //                });
        //            return defer.promise;
        //        }
        //
        //        function getCollectionAsync(url) {
        //            var defer = $q.defer();
        //            $http.get(url)
        //                .then(function (response) {
        //                        var collectionToReturn = [];
        //                        var itemComplete = 0;
        //                        var checkComplete = function () {
        //                            if (itemComplete == items.length) {
        //                                defer.resolve(collectionToReturn);
        //                            }
        //                        };
        //
        //                        var items = response.data.items;
        //                        items.forEach(function (item) {
        //                            getItemInfoAsync(item)
        //                                .then(function (itemInfo) {
        //                                    item.info = itemInfo;
        //                                    collectionToReturn.push(item);
        //                                    itemComplete++;
        //                                    checkComplete();
        //                                }, function (error) {
        //                                    itemComplete++;
        //                                    checkComplete();
        //                                });
        //                        });
        //                    },
        //                    function (error) {
        //                        defer.reject(error);
        //                    });
        //            return defer.promise;
        //        }
        //
        //        var existingCollection = [];
        //        getCollectionAsync(collectionUrl)
        //            .then(function (collection) {
        //                existingCollection.push(collection);
        //            },
        //                 function(error) {
        //            console.log('Error');
        //        });






    });







function DEBUG(name, item) {
    console.log(name);
    console.log(item);
}