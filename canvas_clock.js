/*
 * © 2013, David F. Houghton
 * 
 * licensed under LGPL v3: http://www.gnu.org/copyleft/lesser.html
 */

// create dfh namespace
var dfh = dfh || {};

/**
 * Global defaults. These set the default color of the face and the features on
 * the face.
 */
dfh.clockDefaults = {
	color : 'black',
	fill : 'white',
	eventColor : function(content) {
		return 'rgba(255, 0, 0, 0.5)';
	},
};

/**
 * Constructor function for clocks.
 */
dfh.Clock = function(canvas, params) {
	// validate parameters
	if (canvas === undefined)
		throw new Error("cannot create clock: canvas undefined");
	if (canvas.getContext === undefined)
		throw new Error("browser does not support canvas element");
	var dim = Math.min(canvas.width, canvas.height);
	if (dim < 55)
		throw new Error("canvas too small; minimum of width and height is 55");

	// configure
	params = params || {};
	params.color = params.color || dfh.clockDefaults.color;
	params.fill = params.fill || dfh.clockDefaults.fill;
	params.hours = params.is24 ? 24 : 12;
	params.hour = params.hour || params.color;
	params.minute = params.minute || params.color;
	params.second = params.second || params.color;
	params.face = params.face || params.color;
	params.axis = params.axis || params.fill;
	params.ticks = params.ticks || {};
	params.ticks.minute = params.ticks.minute || params.color;
	params.ticks.hour = params.ticks.hour || params.color;
	if (params.eventColor) {
		this.eventColor = params.eventColor;
	}

	this.params = params;
	this.canvas = canvas;
	this._setDate();
	this.secondsInDay = 60 * 60 * params.hours;
	this.context = canvas.getContext('2d');
	this.radius = dim / 2 - 2;
	this.center = {
		x : canvas.width / 2,
		y : canvas.height / 2,
	};
	this.width = {
		hour : Math.max(3, this.radius / 20),
		minute : Math.max(2, this.radius / 30),
		second : Math.max(1, this.radius / 40),
	};
	var r = this.radius / 25;
	this.length = {
		hour : [ Math.max(2, 2 * r), Math.max(15, 15 * r) ],
		minute : [ Math.max(3, 3 * r), Math.max(20, 20 * r) ],
		second : [ Math.max(4, 4 * r), Math.max(21, 21 * r) ],
	};
	var axis = Math.max(1, r / 2);
	for ( var key in this.length)
		axis = Math.min(axis, this.length[key][0]);
	this.axis = axis;
	this.events = [];

	// draw it and start it going
	this._start();
};

dfh.Clock.prototype = {
	// the last moment displayed
	time : function() {
		return this.date;
	},

	_daySeconds : 24 * 60 * 60 * 1000,

	_halfDaySeconds : 12 * 60 * 60 * 1000,

	/**
	 * records the current moment and, when necessary, the first and last
	 * seconds displayable on the clock.
	 */
	_setDate : function() {
		var d = new Date();
		var setTimes = this.date === undefined;
		// short circuiting doesn't seem to work
		if (!setTimes)
			setTimes = d.getDate() != this.date.getDate();
		if (!setTimes)
			setTimes = !this.params.is24 && d.getHours() == 12
					&& this.date.getHours() == 11;
		this.date = d;
		if (setTimes) {
			var d1;
			if (this.params.is24 || d.getHours() < 12) {
				d1 = new Date();
				d1.setHours(0, 0, 0, 0);
			} else {
				d1 = new Date();
				d1.setHours(12, 0, 0, 0);
			}
			var s = d1.getTime();
			this.startSecond = s;
			this.endSecond = s
					+ (this.params.is24 ? this._daySeconds
							: this._halfDaySeconds);
		}
	},

	/**
	 * add events to the events to display on this clock
	 */
	add : function() {
		for ( var i = 0; i < arguments.length; i++) {
			this.events.push(arguments[i]);
		}
		// keep events chronologically sorted
		this.events.sort(function(a, b) {
			var n1 = a.start.getTime(), n2 = b.start.getTime();
			if (n1 < n2)
				return -1;
			else if (n2 > n1)
				return 1;
			var b1 = a.end === undefined, b2 = b.end === undefined;
			if (b1 ^ b2)
				return b1 ? 1 : -1;
			return 0;
		});
	},

	// draw the initial face and start the update schedule
	_start : function() {
		var obj = this;
		obj._draw();
		setInterval(function() {
			obj._draw();
		}, 1000);
	},

	// draws various elements of the clock face in an order such that they're
	// properly layered
	_draw : function() {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this._clear_prior_events();
		this._face();
		this._show_time();
		this._axis();
	},

	_clear_prior_events : function() {
		if (!this.events.length)
			return;
		var d = this.startTime();
		while (this.events.length) {
			var e = this.events[0];
			if (e.prior(d))
				this.events.shift();
			else
				break;
		}
	},

	// draws axis the clock's hands turn on
	_axis : function() {
		this.context.beginPath();
		this.context.arc(this.center.x, this.center.y, this.axis, 0,
				2 * Math.PI, false);
		this.context.fillStyle = this.params.axis;
		this.context.fill();
	},

	// draws hands of clock
	_show_time : function() {
		var d = new Date();
		this.date = d;
		var h = this._hour(d), m = this._minute(d), s = this._second(d);
		this._radial(-this.length.hour[0], this.length.hour[1],
				this.width.hour, this.params.hour, h);
		this._radial(-this.length.minute[0], this.length.minute[1],
				this.width.minute, this.params.minute, m);
		this._radial(-this.length.second[0], this.length.second[1],
				this.width.second, this.params.second, s);
	},

	// draws face of clock -- ticks for hours and minutes
	_face : function() {
		// circle
		this.context.lineWidth = 2;
		this.context.strokeStyle = this.params.face;
		this.context.beginPath();
		this.context.arc(this.center.x, this.center.y, this.radius, 0,
				2 * Math.PI, false);
		this.context.fillStyle = this.params.fill;
		this.context.fill();
		// events
		if (this.events.length) {
			var drawn = false;
			for ( var i = 0; i < this.events.length; i++) {
				var e = this.events[i];
				var angles = e.angle(this);
				if (angles) {
					angles[0] = this._fix_angle(angles[0]);
					angles[1] = this._fix_angle(angles[1]);
					this._wedge(angles[0], angles[1], this.color(e.content));
					drawn = true;
				}
			}
			if (drawn) {
				// new arc
				this.context.beginPath();
				this.context.arc(this.center.x, this.center.y, this.radius, 0,
						2 * Math.PI, false);
			}
		}
		// circle around face
		this.context.stroke();
		// ticks
		var length = Math.max(2, this.radius / 20);
		for ( var i = 0; i < 60; i++)
			this._radial(length, 0, 1, this.params.ticks.minute, i / 60);
		length *= 2;
		for ( var i = 0; i < this.params.hours; i++)
			this._radial(length, 0, 3, this.params.ticks.hour, i
					/ this.params.hours);
	},

	/**
	 * Draws a pie wedge in the clock face.
	 * 
	 * @param a1
	 *            first angle in radians
	 * @param a2
	 *            second angle in radians
	 * @param color
	 *            fill color
	 */
	_wedge : function(a1, a2, color) {
		this.context.beginPath();
		this.context.arc(this.center.x, this.center.y, this.radius, a1, a2,
				false);
		this.context.fillStyle = color;
		this.context.fill();
		var p1 = this._radianFromCenter(this.radius, a1), p2 = this
				._radianFromCenter(this.radius, a2);
		this.context.beginPath();
		this.context.moveTo(this.center.x, this.center.y);
		this.context.lineTo(p1[0], p1[1]);
		this.context.lineTo(p2[0], p2[1]);
		this.context.lineTo(this.center.x, this.center.y);
		this.context.fill();
	},

	/**
	 * Converts turns around clock face to radians.
	 * 
	 * @param tau
	 *            turns around clock face
	 * @returns {Number} radians
	 */
	_fix_angle : function(tau) {
		return Math.PI * (tau * 2 - .5);
	},

	// draws a line segment along a line intersecting the center of the clock
	_radial : function(start, end, width, color, angle) {
		this.context.lineWidth = width;
		this.context.strokeStyle = color;
		var b = start <= 0;
		start = this._fromCenter(b ? Math.abs(start) : this.radius - start,
				b ? angle + .5 : angle);
		b = end <= 0;
		end = this._fromCenter(b ? this.radius + end : end, angle);
		this.context.beginPath();
		this.context.moveTo(start[0], start[1]);
		this.context.lineTo(end[0], end[1]);
		this.context.stroke();
	},

	// converts from polar to cartesian co-ordinates, where the pole is the axis
	// of the clock face
	_fromCenter : function(length, angle) {
		var theta = this._fix_angle(angle);
		return this._radianFromCenter(length, theta);
	},

	_radianFromCenter : function(length, theta) {
		var x = length * Math.cos(theta), y = length * Math.sin(theta);
		return [ this.center.x + x, this.center.y + y ];
	},

	// rotation of the hour hand
	_hour : function(d) {
		var s = d.getSeconds(), m = d.getMinutes(), h = d.getHours();
		h = s + 60 * (m + 60 * (h % (this.is24 ? 24 : 12)));
		return h / this.secondsInDay;
	},

	// rotation of the minute hand
	_minute : function(d) {
		var s = d.getSeconds(), m = d.getMinutes();
		m = s + 60 * m;
		return m / 3600;
	},

	// rotation of the second hand
	_second : function(d) {
		return d.getSeconds() / 60;
	},

	/**
	 * Calculates a color for an event to be displayed.
	 * 
	 * @param content
	 *            the content attribute of a dfh.Event
	 * @returns a color to paint a wedge of the clock face
	 */
	color : function(content) {
		if (this.eventColor)
			return this.eventColor(content);
		return dfh.clockDefaults.eventColor(content);
	},

	/**
	 * Whether this is a 24 hour clock.
	 * 
	 * @returns {Boolean} whether this is a 24-hour clock
	 */
	is24 : function() {
		return this.params.is24 && true;
	},

	/**
	 * @returns first moment shown on clock
	 */
	startTime : function() {
		if (this.params.is24 || this.date.getHours() < 12) {
			var d = new Date();
			d.setHours(0, 0, 0, 0);
			return d;
		} else {
			var d = new Date();
			d.setHours(12, 0, 0, 0);
			return d;
		}
	},

	/**
	 * @returns last moment shown on clock
	 */
	endTime : function() {
		if (this.params.is24 || this.date.getHours() >= 12) {
			var d = new Date();
			d.setHours(23, 59, 59, 999);
			return d;
		} else {
			var d = new Date();
			d.setHours(11, 59, 59, 999);
			return d;
		}
	}
};

/**
 * Constructor for events.
 * 
 * @param start
 *            when the event begins -- a Date
 * @param end
 *            when the event ends -- a Date
 * @param content
 *            information to associate with the event
 */
dfh.Event = function(start, end, content) {
	if (!(start instanceof Date))
		Error("start must be Date");

	this.start = start;
	this.end = end;
	this.content = content;
};

dfh.Event.prototype = {
	/**
	 * converts the period covered by the event to a wedge on the face of the
	 * clock
	 * 
	 * @param clock
	 * @returns start and end angles; undefined if the angle is undisplayable
	 */
	angle : function(clock) {
		if (this.displayable(clock)) {
			var d1 = clock.startTime(), d2 = clock.endTime();
			var start = d1.getTime() < this.start.getTime() ? this.start : d1;
			var end = this.end == undefined
					|| d2.getTime() < this.end.getTime() ? d2 : this.end;
			return [ clock._hour(start), clock._hour(end) ];
		} else {
			return undefined;
		}
	},

	/**
	 * Whether this event occurs prior to the given date.
	 * 
	 * @param date
	 *            {Date}
	 * @returns {Boolean}
	 */
	prior : function(date) {
		if (this.end === undefined)
			return false;
		return this.end.getTime() < date.getTime();
	},

	/**
	 * 
	 * @param clock
	 * @returns {Boolean} whether this event corresponds to any period of time
	 *          on the current clock
	 */
	displayable : function(clock) {
		if (this.end === undefined)
			return true;
		var s1 = this.start.getTime(), s2 = this.end.getTime();
		return s2 > clock.startSecond && s1 < clock.endSecond;
	},
};
