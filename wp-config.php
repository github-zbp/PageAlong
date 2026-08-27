<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'tutorial_zbpblog' );

/** Database username */
define( 'DB_USER', 'tutorial_zbpblog' );

/** Database password */
define( 'DB_PASSWORD', '573234044jqsf' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'lT1Nq80QDzk&h$L{*`)if4`v}H}e^bL~mb(znA03V*{iQ`fh5/uQ-u?HPA0qh<VT' );
define( 'SECURE_AUTH_KEY',  'Lr)#.;`hg$c7+xkBWdxjJ^iw]=Q;?jv3;0F{[WJn[.k5u:*!>19R/IQZJn6SfTO5' );
define( 'LOGGED_IN_KEY',    'QR^R$X&]BoEi&Qs8^JdU,Z5CIBVs|f *K8!e^&*TXvl7mxo<5yMWy;R;M,TsxB^2' );
define( 'NONCE_KEY',        'Gco}5NOu %m}v|/VX`UW.5kjHUG.sEUZ!1cYgVTTFDL.g3`gS2;a:[uM1Wy^`MV%' );
define( 'AUTH_SALT',        'xsF=n4UjQ{A!cGc`/tUG-#t?LJ>s2E,}d5o&6A6q]404!l~fLpMFz6.1*NkCrHaJ' );
define( 'SECURE_AUTH_SALT', '[2(f&J4KVCkwGea- JZ8F~C3nSg?*Tx0lBL=^1+>Yp{-XWkAANcxkP/ 2`[0Ujp;' );
define( 'LOGGED_IN_SALT',   'Tb+]H)AfWN:q|yGgzs}~a|7 >4BqRDdIQ^2cuw2.;s]pu[QN1%!XhVO0mrQ,ov{S' );
define( 'NONCE_SALT',       '9193X1mpgw741|$&u!NiP&y}E={sH>u9`{{3W=iZ7Wmo,`hIPzY*rB)JtPq+Um0:' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', false );

/* Add any custom values between this line and the "stop editing" line. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';

