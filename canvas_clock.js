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
	eventColor : function(event, clock) {
		if (event.start.getTime() < clock.startSecond)
			return 'rgba(0, 0, 255, 0.5)';
		if (event.end === undefined)
			return 'rgba(0, 255, 0, 0.5)';
		if (event.end.getTime() > clock.endSecond)
			return 'rgba(0, 125, 125, 0.5)';
		return 'rgba(255, 0, 0, 0.5)';
	},
	shadow : {
		color : 'rgba(0, 0, 0, 0.5)',
		x : 2,
		y : 2,
		blur : 5,
	},
};

/**
 * Function that finds the page position of an element.
 */
dfh.findPos = function(obj) {
	var curleft = 0, curtop = 0;
	if (obj.offsetParent) {
		do {
			curleft += obj.offsetLeft;
			curtop += obj.offsetTop;
		} while (obj = obj.offsetParent);
		return {
			x : curleft,
			y : curtop
		};
	}
	return undefined;
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
	var p = {};
	p.color = params.color || dfh.clockDefaults.color;
	p.fill = params.fill || dfh.clockDefaults.fill;
	p.hours = params.is24 ? 24 : 12;
	p.show = {
		hands : !(params.noHands || (params.noHour && params.noMinute && params.noSecond)),
		hour : !params.noHour,
		minute : !params.noMinute,
		second : !params.noSecond,
		ticks : !(params.noTicks || (params.noMinuteTicks && params.noHourTicks)),
		minuteTicks : !params.noMinuteTicks,
		hourTicks : !params.noHourTicks,
	};
	p.hour = params.hour || p.color;
	p.minute = params.minute || p.color;
	p.second = params.second || p.color;
	p.face = params.face || p.color;
	p.axis = params.axis || p.fill;
	p.ticks = {};
	var pticks = params.ticks || {};
	for ( var t in pticks)
		p.ticks[t] = pticks[t];
	p.ticks.minute = p.ticks.minute || p.color;
	p.ticks.hour = p.ticks.hour || p.color;
	if (params.eventColor) {
		this.ecolor = params.eventColor;
	} else {
		this.ecolor = dfh.clockDefaults.eventColor;
	}
	this.context = canvas.getContext('2d');
	var margin = 2;
	if (params.shadow) {
		var color = params.shadow.color || dfh.clockDefaults.shadow.color;
		var x = params.shadow.x || dfh.clockDefaults.shadow.x;
		var y = params.shadow.y || dfh.clockDefaults.shadow.y;
		var blur = params.shadow.blur || dfh.clockDefaults.shadow.blur;
		p.shadow = {
			"color" : color,
			"x" : x,
			"y" : y,
			"blur" : blur,
		};
		margin += Math.max(x, y) + blur;
	}

	this.params = p;
	this.canvas = canvas;
	this._setDate();
	this.secondsInDay = 60 * 60 * p.hours;
	this.radius = dim / 2 - margin;
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
		this._showTime();
		if (this.params.show.hands)
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
	_showTime : function() {
		this._setDate();
		var d = this.date;
		if (this.params.show.hands) {
			if (this.params.shadow)
				this._setShadow(2);
			if (this.params.show.hour) {
				var h = this._hour(d);
				this._radial(-this.length.hour[0], this.length.hour[1],
						this.width.hour, this.params.hour, h);
			}
			if (this.params.show.minute) {
				var m = this._minute(d);
				this._radial(-this.length.minute[0], this.length.minute[1],
						this.width.minute, this.params.minute, m);
			}
			if (this.params.show.second) {
				var s = this._second(d);
				this._radial(-this.length.second[0], this.length.second[1],
						this.width.second, this.params.second, s);
			}
			if (this.params.shadow)
				this.context.restore();
		}
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
		if (this.params.shadow)
			this._setShadow();
		this.context.fill();
		if (this.params.shadow)
			this.context.restore();
		// events
		if (this.events.length) {
			var drawn = false;
			for ( var i = 0; i < this.events.length; i++) {
				var e = this.events[i];
				var angles = e.angle(this);
				if (angles) {
					angles[0] = this._fix_angle(angles[0]);
					angles[1] = this._fix_angle(angles[1]);
					this._wedge(angles[0], angles[1], this.color(e));
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
		if (this.params.show.ticks) {
			var length = Math.max(2, this.radius / 20);
			if (this.params.show.minuteTicks) {
				for ( var i = 0; i < 60; i++)
					this
							._radial(length, 0, 1, this.params.ticks.minute,
									i / 60);
			}
			length *= 2;
			if (this.params.show.hourTicks) {
				for ( var i = 0; i < this.params.hours; i++)
					this._radial(length, 0, 3, this.params.ticks.hour, i
							/ this.params.hours);
			}
		}
	},

	_setShadow : function(reduction) {
		reduction = reduction || 1;
		if (reduction < 1)
			Error("shadow reduction factor cannot be less than 1");
		this.context.save();
		this.context.shadowColor = this.params.shadow.color;
		this.context.shadowBlur = this.params.shadow.blur / reduction;
		this.context.shadowOffsetX = this.params.shadow.x / reduction;
		this.context.shadowOffsetY = this.params.shadow.y / reduction;
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
		if (a2 - a1 > Math.PI) {
			var a3 = a1 + Math.PI;
			this._wedge(a1, a3, color);
			this._wedge(a3, a2, color);
		} else {
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
		}
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
	color : function(event) {
		if (!(event instanceof dfh.Event))
			Error("not an event");
		return this.ecolor(event, this);
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
	},

	/**
	 * Converts a location on the clock face to the corresponding time.
	 * 
	 * @param x
	 *            horizontal canvas coordinate
	 * @param y
	 *            vertical canvas coordinate
	 * @returns {Date} corresponding to this point on the clock face, or
	 *          undefined if the given position is not on the clock face
	 */
	dateAt : function(x, y) {
		if (x.pageX) {
			var p = dfh.findPos(this.canvas);
			y = x.pageY - p.y;
			x = x.pageX - p.x;
		}
		var pos = this.pos(x, y);
		if (!pos.on)
			return undefined;
		var m = this.secondsInDay * pos.tau * 1000;
		m += this.startSecond;
		return new Date(m);
	},

	/**
	 * 
	 * @param x a {Date} or a value suitable as the first parameter of dateAt
	 * @param y a vertical position in the canvas
	 * @returns
	 */
	eventAt : function(x, y) {
		var d;
		if (x.getTime)
			d = x;
		else
			d = this.dateAt(x, y);
		if (d === undefined)
			return undefined;
		for ( var i = 0; i < this.events.length; i++) {
			var e = this.events[i];
			if (e.start.getTime() > d.getTime())
				return undefined;
			if (e.end === undefined || e.end.getTime() > d.getTime())
				return e;
		}
		return undefined;
	},

	/**
	 * Obtains position information for either a co-ordinate relative to the
	 * canvas or a mouse event.
	 * 
	 * @param x
	 *            horizontal position relative to the canvas or a mouse event
	 * @param y
	 *            vertical position relative to the canvas
	 * @returns object with keys x, y, on, tau; the first two are co-ordinates
	 *          relative to the axis of the clock; on specifies whether this
	 *          point is on the clock face; tau is the rotation around the face
	 *          from the 0 position (noon on a 12 hour clock)
	 */
	pos : function(x, y) {
		if (x.pageX) {
			var p = dfh.findPos(this.canvas);
			y = x.pageY - p.y;
			x = x.pageX - p.x;
		}
		y = y - this.center.y;
		x = x - this.center.x;
		var tau;
		if (y < 0) {
			if (x < 0) {
				tau = Math.atan(-y / -x) / (Math.PI * 2) + .75;
			} else if (x == 0) {
				tau = 0;
			} else {
				tau = .25 - Math.atan(-y / x) / (Math.PI * 2);
			}
		} else if (y == 0) {
			if (x < 0) {
				tau = .75;
			} else if (x == 0) {
				tau = 0;
			} else {
				tau = .25;
			}
		} else {
			if (x < 0) {
				tau = .75 - Math.atan(y / -x) / (Math.PI * 2);
			} else if (x == 0) {
				tau = .5;
			} else {
				tau = .25 + Math.atan(y / x) / (Math.PI * 2);
			}
		}
		return {
			"x" : x,
			"y" : y,
			"tau" : tau,
			on : x * x + y * y <= this.radius * this.radius
		};
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
			var end;
			if (this.end === undefined)
				end = clock.date;
			else if (d2.getTime() < this.end.getTime())
				end = d2;
			else
				end = this.end;
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
		var s1 = this.start.getTime();
		if (s1 > clock.date.getTime())
			return false;
		if (this.end === undefined)
			return true;
		var s2 = this.end.getTime();
		return s2 > clock.startSecond;
	},
};
