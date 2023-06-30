import { Button, ButtonGroup, ClickAwayListener, Grow, MenuItem, MenuList, Paper, Popper } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useState, useRef, useEffect } from 'react';
import { EnumMember } from 'typescript';

interface IdOption<T = string|number|EnumMember> {
  id: T;
  text: string;
}

export function splitOptionsFromStrings(options: string[]) {
  return options.map(o => ({ id: o, text: o }));
}

export function SplitButton<K extends string|number|EnumMember, T extends IdOption<K>>(
  { options, selected, onClick }: { options: T[], selected?: K, onClick?: (value: K) => void}
) {
  const [open, setOpen] = useState(false);
  const [ buttonId ] = useState(Math.random() * 10000);
  const anchorRef = useRef<HTMLDivElement>(null);

  const [selectedIndex, setSelectedIndex] = useState(options.findIndex(o => o.id === selected));

  useEffect(() => {
    setSelectedIndex(options.findIndex(o => o.id === selected));
  }, [ options, selected ]);
  
  const handleClick = () => {
    onClick?.(options[selectedIndex].id);
  };

  const handleMenuItemClick = (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    index: number,
  ) => {
    onClick?.(menuOptions[index].id);
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }

    setOpen(false);
  };

  const menuOptions = options.filter(option => option.id !== selected);
  return (<>
    <ButtonGroup variant="contained" ref={anchorRef} aria-label="split button">
      <Button onClick={handleClick}>{options[selectedIndex].text}</Button>
      {!!menuOptions.length &&<Button
        size="small"
        aria-controls={open ? 'split-button-menu' + buttonId : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-label="select merge strategy"
        aria-haspopup="menu"
        onClick={handleToggle}
      >
        <ArrowDropDownIcon />
      </Button>}
    </ButtonGroup>
    <Popper
      sx={{
        zIndex: 1,
      }}
      open={open}
      anchorEl={anchorRef.current}
      role={undefined}
      transition
      disablePortal
    >
      {({ TransitionProps, placement }) => (
        <Grow
          {...TransitionProps}
          style={{
            transformOrigin:
              placement === 'bottom' ? 'center top' : 'center bottom',
          }}
        >
          <Paper>
            <ClickAwayListener onClickAway={handleClose}>
              <MenuList id={`split-button-menu${buttonId}`} autoFocusItem>
                {menuOptions.map((option, index) => (
                  <MenuItem
                    key={option.id + ''}
                    onClick={(event) => handleMenuItemClick(event, index)}
                  >
                    {option.text}
                  </MenuItem>
                ))}
              </MenuList>
            </ClickAwayListener>
          </Paper>
        </Grow>
      )}
    </Popper>
  </>
  )
}