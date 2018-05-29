/*global jQuery, Handlebars, Router */
jQuery(function($) {
  'use strict';

  //register the helper for handlebars so the footer template appears
  Handlebars.registerHelper('eq', function(a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13; //store the key code for the enter key 
  var ESCAPE_KEY = 27; //store the key code for the escape key

  //this is the object that contains our utility functions
  var util = {
    //generates a UUID for each TODO
    uuid: function() {
      /*jshint bitwise:false */
      var i; //good practice to declare all variables separately
      var random; //stores random number
      var uuid = ''; //will store the uuid as a string

      for (i = 0; i < 32; i++) {
        random = (Math.random() * 16) | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += '-';
        }
        uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(
          16
        );
      }

      return uuid;
    },
    //makes a word plural - used in footer for n item(s)
    pluralize: function(count, word) {
      return count === 1 ? word : word + 's';
    },
    //stores the todos as a stringified json in localstorage (also reads from it)
    store: function(namespace, data) {
      //if we pass in both namespace and data, then we store
      if (arguments.length > 1) {
        return localStorage.setItem(namespace, JSON.stringify(data));
        // if we only pass in 1 argument, we get the data
      } else {
        //we get what's stored in localstorage for the namespace
        var store = localStorage.getItem(namespace);
        //and return it
        return JSON.parse(store) || []; //checking for both store and json.parse(store) seems redundant
        // return (store && JSON.parse(store)) || [];
      }
    }
  };

  //this is the object that contains our app
  var App = {
    init: function() {
      //loads the todo data (or [])
      this.todos = util.store('todos-jquery');
      //loads template for todos 
      this.todoTemplate = Handlebars.compile($('#todo-template').html());
      //loads template for footer
      this.footerTemplate = Handlebars.compile($('#footer-template').html());

      //binds the events through bindEvents function
      this.bindEvents();

      //router that handles the filtering of active/completed/all
      new Router({
        '/:filter': function(filter) {
          this.filter = filter;
          this.render();
        }.bind(this)
        //runs showing '/all' todos by default
      }).init('/all');
    },
    bindEvents: function() {
      //binds a keyup event for #new-todo input field. We need to bind this so that binding
      //uses App rather than bindEvents
      $('#new-todo').on('keyup', this.create.bind(this));
      //attaches change event for the toggle all button
      $('#toggle-all').on('change', this.toggleAll.bind(this));
      //binds click event on clear completed button
      $('#footer').on(
        'click',
        '#clear-completed',
        this.destroyCompleted.bind(this)
      );
      //for entire todo list ul, we bind a bunch of events 
      $('#todo-list')
        //bind change to the checkbox with class toggle
        .on('change', '.toggle', this.toggle.bind(this))
        //bind doubleclick to the label
        .on('dblclick', 'label', this.edit.bind(this))
        //bind keyup to the input with the edit class. This input handles changes and
        //updates the label which is what is shown
        .on('keyup', '.edit', this.editKeyup.bind(this))
        //binds focusout for the input with edit class (updates)
        .on('focusout', '.edit', this.update.bind(this))
        //binds a click to the button with the destroy class
        .on('click', '.destroy', this.destroy.bind(this))
        //binds a click to the button with the important class
        .on('click', '.important', this.important.bind(this));
    },
    //function that renders the items to the screen
    render: function() {
      //get filtered todos (active or completed)
      var todos = this.getFilteredTodos();
      //set html of todo-list ul to the todo template with the todos
      $('#todo-list').html(this.todoTemplate(todos));
      //toggle the main section if we have at least 1 todo (shows todos and toggle button)
      $('#main').toggle(todos.length > 0);
      //this sets the property "checked" to be whatever the active todos length is. If 0, then true, else false
      $('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
      //renders the footer 
      this.renderFooter();
      //after everything we set focus back to input 
      $('#new-todo').focus();
      //we write the todos to localstorage
      util.store('todos-jquery', this.todos);
    },
    renderFooter: function() {
      //we get the todo count
      var todoCount = this.todos.length;
      //get the activeTodo counts
      var activeTodoCount = this.getActiveTodos().length;
      //set the template variables for the footer
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, 'item'),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter
      });

      $('#footer')
      //we only show the footer if we have at least 1 todo
        .toggle(todoCount > 0)
        //we set the html to the template 
        .html(template);
    },
    toggleAll: function(e) {
      //is the checkbox checked? 
      var isChecked = $(e.target).prop('checked');
      //for each todo, we set completed to whatever isChecked is 
      this.todos.forEach(function(todo) {
        todo.completed = isChecked;
      });
      //run the render method
      this.render();
    },
    getActiveTodos: function() {
      //we return the filtered todos that are not set as completed
      return this.todos.filter(function(todo) {
        return !todo.completed;
      });
    },
    //we get the completed todos using filter method
    getCompletedTodos: function() {
      return this.todos.filter(function(todo) {
        return todo.completed;
      });
    },
    //we get the filtered todos
    getFilteredTodos: function() {
      //check if filter is set as active (uses router)
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }
      //check if filter is set as completed (uses router url)
      if (this.filter === 'completed') {
        return this.getCompletedTodos();
      }

      return this.todos;
    },
    destroyCompleted: function() {
      //grabs only the actives, sets filter to all, runs render
      this.todos = this.getActiveTodos();
      //set the filter to 'all' after we get only actives
      this.filter = 'all';
      //run the render method which will now see 'all' and store the active todos only
      //effectively erasing the completed todos
      this.render();
    },
    // accepts an element from inside the `.view` div and
    // returns the corresponding index in the `todos` array
    indexFromEl: function(el) {
      //we get the uuid of closest LI to the todo
      var id = $(el)
        .closest('li')
        .data('id');
      var todos = this.todos;
      var i = todos.length;

      //loop through the todos and match uuid... grab index
      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    },
    create: function(e) {
      //this is bound to the keyup 
      //create a jquery item of the target event
      var $input = $(e.target);
      //grab the trimmed value that was input
      var val = $input.val().trim();

      //if the key pressed was the enter key or the value is empty, we just return
      if (e.which !== ENTER_KEY || !val) {
        return;
      }

      //otherwise we push the new todo item to the todos
      this.todos.push({
        id: util.uuid(),
        title: val,
        completed: false,
        important: false
      });

      //then we empty the input
      $input.val('');

      //then we run the render method to do its thang
      this.render();
    },
    toggle: function(e) {
      //we grab the index for the related todo item
      var i = this.indexFromEl(e.target);
      //we set the completed for each todo to opposite of what it is
      this.todos[i].completed = !this.todos[i].completed;

      //we run our render method
      this.render();
    },
    important: function(e) {
      //we grab the index for the related todo item
      var i = this.indexFromEl(e.target);
      //we set the completed for each todo to opposite of what it is
      this.todos[i].important = !this.todos[i].important;

      //we run our render method
      this.render();
    },
    edit: function(e) {
      //we find the closest li, add the 'editing' class, and then find the element
      //with the .edit class (input that has the value shown)
      var $input = $(e.target)
        .closest('li')
        .addClass('editing')
        .find('.edit');
      $input.focus();
    },
    editKeyup: function(e) {
      //if the key pressed was enter, we remove focus from the element
      if (e.which === ENTER_KEY) {
        e.target.blur();
      }
      //if the key was escape, we set a data attribute to abort (@TODO: not used?)
      //and then remove the focus from the element. We can maybe ignore the new data
      //attribute and just blur always.
      if (e.which === ESCAPE_KEY) {
        $(e.target)
          .data('abort', true)
          .blur();
      }
    },
    update: function(e) {
      var $el = $(e.target);
      var val = $el.val().trim();

      //destroy the element if no value and return
      if (!val) {
        this.destroy(e);
        return;
      }

      //if the abort data attrib was set, we set to false. @TODO: why? 
      if ($el.data('abort')) {
        $el.data('abort', false);
      } else {
        //if not set, then we set the title of todo to the value
        this.todos[this.indexFromEl($el)].title = val;
      }
      //run our render method
      this.render();
    },
    destroy: function(e) {
      //we grab the index and splice out the todo from the todos
      this.todos.splice(this.indexFromEl(e.target), 1);
      //run our render method again
      this.render();
    }
  };

  //this runs the init function in App upon load
  App.init(); 
});
