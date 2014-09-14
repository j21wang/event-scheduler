goog.require('goog.dom');

goog.provide('facebook.calendar');
goog.provide('facebook.calendar.Event');

var DataConfig = {
  HEIGHT: 720,
  WIDTH: 620,
  MARGIN_LEFT: 40,
  MARGIN_TOP: 20,
  MARGIN_RIGHT: 20,
  MARGIN_BOTTOM: 20,
  EVENT_MARGIN: 10,
  DOMAIN_START: 0,
  DOMAIN_END: 720,
  TICK_VALUES: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
      360, 390, 420, 450, 480, 510, 540, 570, 600, 630, 660, 690, 720],
  EVENT_LABELS_XSHIFT: 25,
  EVENT_TITLE_YSHIFT: 18,
  EVENT_LOCATION_YSHIFT: 30,
  LEFT_BORDER_LINE_XSHIFT: 13,
  LARGE_TICK_LABELS_XSHIFT: -30,
  // Measurement for dy shift of tick labels defined by D3.
  D3_DEFINED_TICK_LABELS_DY: '.32em'
};

facebook.Calendar = function(data) {
  this.data_ = data;
  this.timeScale_ = null;
  this.timeAxis_ = null;
  this.svg_ = null;
  this.events_ = [];
  this.eventGroup_ = null;
};

facebook.Calendar.prototype.createDom = function() {
  this.drawSchedule_();
};

facebook.Calendar.prototype.drawSchedule_ = function() {
  this.sortData_();
  this.placeEvents_();
  this.defineTimeAxis_();
  this.drawData_();
  this.drawTimeAxis_();
};

facebook.Calendar.prototype.sortData_ = function() {
  goog.array.sort(this.data_, function(a, b) {
    var difference = a.start - b.start;
    if (difference) return difference;
    return a.end - b.end;
  });
};

/**
 * Check if event belongs in current chunk.
 */
facebook.Calendar.prototype.belongsInChunk_ = function(columnEnds, evt) {
  for (var i = 0; i < columnEnds.length; i++) {
    if (evt.start < columnEnds[i]) return true;
  }
  return false;
};

/**
 * Tries to find a spot in the current chunk for the event.
 */
facebook.Calendar.prototype.findSpaceInChunk_ = function(columnEnds, evt) {
  for (var i = 0; i < columnEnds.length; i++) {
    if (evt.start >= columnEnds[i]) return i;
  }
  return -1;
}

/**
 * Determines the placement of the event on the schedule.
 */
facebook.Calendar.prototype.placeEvents_ = function() {
  var columnEnds = []; // end of all columns in current chunk
  var count = 0; // count of events in current chunk

  for (var i = 0; i < this.data_.length; i++) {
    var columnIndex = this.findSpaceInChunk_(columnEnds, this.data_[i]);
    var sameChunk = this.belongsInChunk_(columnEnds, this.data_[i]);  

    if (sameChunk && columnIndex > -1) { // add to same column in chunk
      columnEnds[columnIndex] = this.data_[i].end;
      this.events_.push({data: this.data_[i],
          columnIndex: columnIndex, numCols: 1});
      count++;
    } else if (sameChunk && columnIndex == -1) { // make new column in chunk
      this.events_.push({data: this.data_[i],
          columnIndex: columnEnds.length, numCols: 1});
      columnEnds.push(this.data_[i].end);
      count++;
    } else { // finish chunk and create new chunk
      this.events_.push({data: this.data_[i], columnIndex: 0, numCols: 1});
      this.updateColCount_(i, i - count - 1, columnEnds.length); 
      columnEnds = [];
      columnEnds.push(this.data_[i].end);
      count = 1;
    }
    if (i == this.data_.length - 1) {
      this.updateColCount_(i, i - count, columnEnds.length); 
    }
  }
};

/**
 * Updates the number of columns there are in a chunk so that the width
 * of each event can be calculated.
 */
facebook.Calendar.prototype.updateColCount_ = function(start, end, numCols) {
  for (var i = start; i > end; i--) {
    this.events_[i].numCols = numCols;
  }
};

facebook.Calendar.prototype.drawEmptyCalendar_ = function() {
  this.svg_ = d3.select('#calendar')
      .append('svg')
      .attr('width', DataConfig.WIDTH + DataConfig.MARGIN_LEFT +
          DataConfig.MARGIN_RIGHT)
      .attr('height', DataConfig.HEIGHT + DataConfig.MARGIN_TOP +
          DataConfig.MARGIN_BOTTOM)
      .append('g')
      .attr('transform', this.translate_(DataConfig.MARGIN_LEFT * 2,
          DataConfig.MARGIN_TOP));

  this.svg_.append('rect')
      .attr('class', 'background')
      .attr('height', DataConfig.HEIGHT)
      .attr('width', DataConfig.WIDTH);
};

/**
 * Defines bounds for each event to prevent overflow of text.
 */
facebook.Calendar.prototype.defineRectClipBounds_ = function() {
  this.svg_.append('g').selectAll('.eventRect')
      .attr('class', 'rectClipBounds')
      .data(this.data_)
      .enter()
      .append('defs')
      .append('clipPath')
      .attr('id', function(d, i) {
        return 'textclip' + i;
      })
      .append('rect')
      .attr('x', goog.bind(function(d, i) {
        var width = (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
        return width * this.events_[i].columnIndex + DataConfig.EVENT_MARGIN;
      }, this))
      .attr('y', goog.bind(function(d) {
        return this.timeScale_(d.start);
      }, this))
      .attr('width', goog.bind(function(d, i) {
        return (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
      }, this))
      .attr('height', goog.bind(function(d) {
        return this.timeScale_(d.end - d.start);
      }, this));
};

facebook.Calendar.prototype.defineEventGroup_ = function() {
  this.eventGroup_ = this.svg_.selectAll('.eventGroup')
      .data(this.data_)
      .enter()
      .append('g')
      .attr('class', 'eventGroup');
};

facebook.Calendar.prototype.drawEvents_ = function() {
  this.eventGroup_.append('rect')
      .attr('class', 'eventRect')
      .attr('x', goog.bind(function(d, i) {
        var width = (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
        return width * this.events_[i].columnIndex + DataConfig.EVENT_MARGIN;
      }, this))
      .attr('y', goog.bind(function(d) {
        return this.timeScale_(d.start);
      }, this))
      .attr('width', goog.bind(function(d, i) {
        return (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
      }, this))
      .attr('height', goog.bind(function(d) {
        return this.timeScale_(d.end - d.start);
      }, this));
};

facebook.Calendar.prototype.drawEventLine_ = function() {
  this.eventGroup_
      .append('line')
      .attr('class', 'eventLine')
      .attr('y2', function(d) {
        return d.end - d.start;
      })
      .attr('transform', goog.bind(function(d, i) {
        var width = (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
        return this.translate_(width * this.events_[i].columnIndex +
            DataConfig.LEFT_BORDER_LINE_XSHIFT,
        this.timeScale_(d.start));
      }, this));
};

facebook.Calendar.prototype.translate_ = function(x, y) {
  return 'translate(' + x + ',' + y + ')';
};

facebook.Calendar.prototype.appendEventText_ = function() {
  this.eventGroup_.append('text')
      .attr('class', 'eventName')
      .attr('x', goog.bind(function(d, i) {
        var width = (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
            this.events_[i].numCols;
        return width * this.events_[i].columnIndex +
            DataConfig.EVENT_LABELS_XSHIFT;
      }, this))
      .attr('y', goog.bind(function(d) {
        return this.timeScale_(d.start) + DataConfig.EVENT_TITLE_YSHIFT;
      }, this))
      .text('Sample Item')
      .style('clip-path', function(d, i) {
        return 'url(#textclip' + i + ')';
      });

  this.eventGroup_.append('text')
      .attr('class', 'eventLocation')
      .attr('x', goog.bind(function(d, i) {
        var width = (DataConfig.WIDTH - DataConfig.MARGIN_LEFT) /
          this.events_[i].numCols;
        return width * this.events_[i].columnIndex +
          DataConfig.EVENT_LABELS_XSHIFT;
      }, this))
      .attr('y', goog.bind(function(d) {
        return this.timeScale_(d.start) + DataConfig.EVENT_LOCATION_YSHIFT;
      }, this))
      .text('Sample Location')
      .style('clip-path', function(d, i) {
        return 'url(#textclip' + i + ')';
      });
};

facebook.Calendar.prototype.drawData_ = function() {
  this.drawEmptyCalendar_();
  this.defineRectClipBounds_();
  this.defineEventGroup_();
  this.drawEvents_();
  this.drawEventLine_();
  this.appendEventText_();
};

facebook.Calendar.prototype.defineTimeAxis_ = function() {
  this.timeScale_ = d3.scale.linear()
      .domain([DataConfig.DOMAIN_START, DataConfig.DOMAIN_END])
      .range([0, DataConfig.HEIGHT]);

  this.timeAxis_ = d3.svg.axis()
      .scale(this.timeScale_)
      .orient('left')
      .tickValues(DataConfig.TICK_VALUES)
      .tickFormat(function(d) {
          // Because of the two different font sizes and colors
          // needed for the axis, the hour tick labels must be
          // appended as a separate text element in SVG so that
          // a different style can be applied to it.
          if (d == 0) return 'AM';
          else if (d == 30) return '9:30';
          else if (d == 60) return 'AM';
          else if (d == 90) return '10:30';
          else if (d == 120) return 'AM';
          else if (d == 150) return '11:30';
          else if (d == 180) return 'PM';
          else if (d == 210) return '12:30';
          else if (d == 240) return 'PM';
          else if (d == 270) return '1:30';
          else if (d == 300) return 'PM';
          else if (d == 330) return '2:30';
          else if (d == 360) return 'PM';
          else if (d == 390) return '3:30';
          else if (d == 420) return 'PM';
          else if (d == 450) return '4:30';
          else if (d == 480) return 'PM';
          else if (d == 510) return '5:30';
          else if (d == 540) return 'PM';
          else if (d == 570) return '6:30';
          else if (d == 600) return 'PM';
          else if (d == 630) return '7:30';
          else if (d == 660) return 'PM';
          else if (d == 690) return '8:30';
          else if (d == 720) return 'PM';
      });
};

facebook.Calendar.prototype.drawTimeAxis_ = function() {
  this.svg_.append('g')
      .attr('class', 'y axis')
      .call(this.timeAxis_);
  this.styleTicks_();
};

facebook.Calendar.prototype.styleTicks_ = function() {
  this.svg_.selectAll('.tick')
      .filter(function(d, i) {
          // filter all the hour ticks
          return i % 2 == 0;
      })
      .attr('class', 'tick hourTick');

  this.svg_.selectAll('.hourTick')
     .append('text')
     .attr('class', 'timeText')
     .text(function(d) {
        // Because of the two different font sizes and colors
        // needed for the axis, the hour tick labels must be
        // appended as a separate text element in SVG so that
        // a different style can be applied to it.
        if (d == 0) return '9:00';
        else if (d == 60) return '10:00';
        else if (d == 120) return '11:00';
        else if (d == 180) return '12:00';
        else if (d == 240) return '1:00';
        else if (d == 300) return '2:00';
        else if (d == 360) return '3:00';
        else if (d == 420) return '4:00';
        else if (d == 480) return '5:00';
        else if (d == 540) return '6:00';
        else if (d == 600) return '7:00';
        else if (d == 660) return '8:00';
        else if (d == 720) return '9:00';
    })
    .attr('x', DataConfig.LARGE_TICK_LABELS_XSHIFT)
    .attr('dy', DataConfig.D3_DEFINED_TICK_LABELS_DY);
};
