#!/usr/bin/env node

var flatiron = require( 'flatiron');
var app = flatiron.app;
var fs = require( 'fs' );

var sites_enabled_dir = '/etc/nginx/sites-enabled';
var sites_available_dir = '/etc/nginx/sites-available';

var wordpress_template = '../templates/wordpress-template.conf';
var php_template = '../templates/php-template.conf';
var nodejs_template = '../templates/nodejs-template.conf';

var display_error = function( err ) {
	app.log.error( err );
	return process.exit(1);
}

app.use( flatiron.plugins.cli, {
	dir: __dirname,
	usage: [
		'Nginx utility that allows to Create List Update Delete Enable Disable available sites',
		'',
		'create - Create a new website',
		'delete - Delete a website',
		'list - List available websites',
		'list-enabled - List enabled websites',
		'enable - Enable a wesbte',
		'disable - Disable a website',
	]
});

// Create a website handler
app.cmd( 'create', function () {
	var domain = '';
	var subdomain = '';
	var template = '';
	app.prompt.get( 'Domain name(domain.tld)', function ( err, result ) {
		domain = result['Domain name(domain.tld)'];
		app.prompt.get( 'Subdomain name(subdomain.domain.tld or empty)', function ( err, result ) {
			subdomain = result['Subdomain name(subdomain.domain.tld or empty)'];
			app.prompt.get( 'Template(wordpress,php,nodejs)', function ( err, result ) {
				template = result['Template(wordpress,php,nodejs)'];
				switch ( template ) {
					case 'wordpress':
						create_site( domain, subdomain, wordpress_template );
						break;
					case 'php':
						create_site( domain, subdomain, php_template );
						break;
					case 'nodejs':
						create_site( domain, subdomain, nodejs_template );
						break;
					default:
						display_error( 'Invalid template! Your choice: ' + template + ' Available choices: wordpress, php, nodejs' );
				}
			});
		});
	});
});

var create_site = function( domain, subdomain, template ) {
	fs.readFile( template, 'utf8', function( err, contents ) {
		if ( err ) {
			display_error( err );
		}

		var server_name = /server_name domain.tld/;
		var server_name_r = '';
		var root = /root \/var\/www\/domains\/domain.tld\/http/;
		var root_r = '';
		var access_log = /access_log \/var\/log\/nginx\/domain.tld.log/;
		var access_log_r = '';
		var error_log = /error_log \/var\/log\/nginx\/domain.tld.error.log/;
		var error_log_r = '';
		var root_path = '';

		var filename = '';
		if ( subdomain.length > 0 ) {
			filename = subdomain + '.' + domain;
			server_name_r = 'server_name ' + filename;
			root_r = 'root /var/www/domains/' + domain + '/subdomains/' + subdomain + '/http';
			root_path = [
				'/www/domains/' + domain,
				'/www/domains/' + domain + '/subdomains',
				'/www/domains/' + domain + '/subdomains/' + subdomain,
				'/www/domains/' + domain + '/subdomains/' + subdomain + '/http'
			];
			access_log_r = 'access_log /var/log/nginx/' + filename + '.log';
			error_log_r = 'error_log /var/log/nginx/' + filename + '.error.log';
		} else {
			filename = domain;
			server_name_r = 'server_name ' + filename;
			root_r = 'root /var/www/domains/' + filename + '/http';
			root_path = [
				'/www/domains/' + filename,
				'/www/domains/' + filename + '/http'
			];
			access_log_r = 'access_log /var/log/nginx/' + filename + '.log';
			error_log_r = 'error_log /var/log/nginx/' + filename + '.error.log';
		}

		contents = contents.replace( server_name, server_name_r );
		contents = contents.replace( root, root_r );
		contents = contents.replace( access_log, access_log_r );
		contents = contents.replace( error_log, error_log_r );

		fs.writeFile( sites_available_dir + '/' + filename, contents, function (err) {
		  if ( err ) {
				display_error( err );
			}
			var created = false;
			for( path in root_path ) {
				if ( fs.existsSync( root_path[path] ) === false ) {
					fs.mkdirSync( root_path[path], 0775 );
					created = true;
				}
			}
			if ( created ) {
				app.log.info( 'Created ' + root_path[root_path.length - 1] );
			}
			app.prompt.get( 'Enable ' + filename + '(y/n)?', function ( err, result ) {
				if ( result['Enable ' + filename + '(y/n)?'] == 'y' || 'Enable ' + filename + '(y/n)?' == 'Y' ) {
					enable_site( filename );
				} else {
					app.log.info( 'Site ' + filename + ' successfully added but is not enabled.' );
				}
			});
		});
	});
};

// List ALL websites handler
app.cmd( 'list', function () {
	list_sites( true );
});

// List Enabled websites handler
app.cmd( 'list-enabled', function () {
	list_enabled_sites( false );
});

var list_enabled_sites = function() {
	list_sites( false );
}

var list_sites = function( all ) {
	var path_to_read = '';
	var available_sites = [];
	var enabled_sites = [];
	if ( all ) {
		path_to_read = sites_available_dir;
	} else {
		path_to_read = sites_enabled_dir;
	}

	fs.readdir( sites_available_dir, function( err, files ) {
		if ( err ) {
			display_error( err );
		}
		available_sites = files.sort();
		fs.readdir( sites_enabled_dir, function( err, files ) {
			if ( err ) {
				display_error( err );
			}
			enabled_sites = files.sort();
			if ( all ) {
				for ( file in available_sites ) {
					var site = available_sites[file];
					if ( enabled_sites.indexOf( site ) === -1 ) {
						app.log.info( site + ' [\033[0;31mdisabled\033[0m]' );
					} else {
						app.log.info( site + ' [\033[0;32menabled\033[0m]' );
					}
				}
			} else {
				for ( file in enabled_sites ) {
					app.log.info( site + ' [\033[0;32menabled\033[0m]' );
				}
			}
		});
	});
}

// Enable a website handler
app.cmd( 'enable', function () {
	var domain = '';
	app.prompt.get( 'Site name(domain.tld OR subdomain.domain.tld)', function ( err, result ) {
		domain = result['Site name(domain.tld OR subdomain.domain.tld)'];
		enable_site( domain );
	});
});

var enable_site = function( domain ) {
	var src = sites_available_dir + '/' + domain;
	var dst = sites_enabled_dir + '/' + domain;

	fs.exists( src, function( exists ) {
		if ( exists === false ) {
			display_error( 'Site ' + domain + ' doesn\'t exists in ' + sites_available_dir );
		} else {
			fs.exists( dst, function( exists ) {
				if ( exists === true ) {
					display_error( 'Site ' + domain + ' is enabled already. Nothing to do.');
				} else {
					fs.symlink( src, dst, function() {
						app.log.info( domain + ' [\033[0;32menabled\033[0m]' );
					});
				}
			});
		}
	});
};

// Disable a website handler
app.cmd( 'disable', function () {
	var domain = '';
	app.prompt.get( 'Site name(domain.tld OR subdomain.domain.tld)', function ( err, result ) {
		domain = result['Site name(domain.tld OR subdomain.domain.tld)'];
		disable_site( domain );
	});
});

var disable_site = function( domain ) {
	var src = sites_available_dir + '/' + domain;
	var dst = sites_enabled_dir + '/' + domain;

	fs.exists( src, function( exists ) {
		if ( exists === false ) {
			display_error( 'Site ' + domain + ' doesn\'t exists in ' + sites_available_dir );
		} else {
			fs.unlink( dst, function() {
				app.log.info( domain + ' [\033[0;31mdisabled\033[0m]' );
			});
		}
	});
}

app.start();