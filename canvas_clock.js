// create dfh
var dfh = dfh || {};

/**
 * @author houghton
 * 
 */
dfh.clock = function(canvas, params) {
	if (canvas === undefined)
		throw new Error("cannot create clock: canvas undefined");
	if (canvas.getContext === undefined)
		throw new Error("browser does not support canvas element");

	// configure
	params = params || {};
	params.color = params.color || 'black';
	params.fill = params.fill || 'white';
	params.hours = params.is24 ? 24 : 12;
	params.hour = params.hour || params.color;
	params.minute = params.minut || params.color;
	params.second = params.second || params.color;
	params.face = params.face || params.color;
	params.axis = params.axis || params.fill;

	this.params = params;
	this.canvas = canvas;
	this.secondsInDay = 60 * 60 * params.hours;
	this.context = canvas.getContext('2d');
	this.radius = Math.min(canvas.width, canvas.height) / 2 - 2;
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

	// draw it and start it going
	this._start();
};

dfh.clock.prototype = {
	_start : function() {
		var obj = this;
		obj._draw();
		setInterval(function() {
			obj._draw();
		}, 500);
	},

	_draw : function() {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this._face();
		this._show_time();
		this._axis();
	},

	_axis : function() {
		this.context.beginPath();
		this.context.arc(this.center.x, this.center.y, this.axis, 0,
				2 * Math.PI, false);
		this.context.fillStyle = this.params.axis;
		this.context.fill();
	},

	_show_time : function() {
		var d = new Date();
		var h = this._hour(d), m = this._minute(d), s = this._second(d);
		this._radial(-this.length.hour[0], this.length.hour[1],
				this.width.hour, this.params.hour, h);
		this._radial(-this.length.minute[0], this.length.minute[1],
				this.width.minute, this.params.minute, m);
		this._radial(-this.length.second[0], this.length.second[1],
				this.width.second, this.params.second, s);
	},

	_face : function() {
		// circle
		this.context.lineWidth = 2;
		this.context.strokeStyle = this.params.face;
		this.context.beginPath();
		this.context.arc(this.center.x, this.center.y, this.radius, 0,
				2 * Math.PI, false);
		this.context.fillStyle = this.params.fill;
		this.context.fill();
		this.context.stroke();
		// ticks
		var length = this.radius / 10;
		for ( var i = 0; i < this.params.hours; i++)
			this._radial(length, 0, 3, this.params.face, i / this.params.hours);
		length /= 2;
		for ( var i = 0; i < 60; i++)
			this._radial(length, 0, 1, this.params.face, i / 60);
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

	_fromCenter : function(length, angle) {
		var theta = Math.PI * (angle * 2 - .5);
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
};